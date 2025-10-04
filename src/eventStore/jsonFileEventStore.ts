import fs from 'fs/promises';
import path from 'path';
import { getInMemoryEventStore } from '@event-driven-io/emmett';
import type { EventStore } from '@event-driven-io/emmett';

interface JsonFileEventStoreOptions {
  dataDirectory?: string;
}

export function getJsonFileEventStore(options: JsonFileEventStoreOptions = {}): EventStore<any> & { getAllCarts: () => Promise<any[]> } {
  const dataDirectory = options.dataDirectory || './data/events';
  const inMemoryStore = getInMemoryEventStore();

  // Ensure data directory exists
  fs.mkdir(dataDirectory, { recursive: true }).catch(() => {});

  // Override appendToStream to also save to file
  const originalAppendToStream = inMemoryStore.appendToStream.bind(inMemoryStore);
  inMemoryStore.appendToStream = async function(streamId: string, events: any[], options?: any) {
    // Call original append
    const result = await originalAppendToStream(streamId, events, options);

    // Save to JSON file
    try {
      const streamResult = await inMemoryStore.readStream(streamId);
      const filePath = path.join(dataDirectory, `${streamId}.json`);

      const jsonData = {
        streamId,
        events: streamResult.events.map(event => ({
          type: event.type,
          data: event.data,
          metadata: {
            ...event.metadata,
            streamPosition: event.metadata.streamPosition.toString(),
            globalPosition: event.metadata.globalPosition ? event.metadata.globalPosition.toString() : undefined
          }
        })),
        currentStreamVersion: streamResult.currentStreamVersion.toString(),
        lastUpdated: new Date().toISOString()
      };

      await fs.writeFile(filePath, JSON.stringify(jsonData, null, 2));
    } catch (error) {
      console.warn(`Failed to save stream ${streamId} to file:`, error);
    }

    return result;
  };

  // Load existing data from files on startup
  loadExistingData(dataDirectory, inMemoryStore);

  // Add getAllCarts method
  const extendedStore = inMemoryStore as any;
  extendedStore.getAllCarts = async () => {
    try {
      const files = await fs.readdir(dataDirectory);
      const carts = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(dataDirectory, file);
            const data = await fs.readFile(filePath, 'utf-8');
            const jsonData = JSON.parse(data);

            // Reconstruct cart state from events
            const cartSummary = {
              id: jsonData.streamId,
              lastUpdated: jsonData.lastUpdated,
              totalEvents: jsonData.events.length,
              status: 'Opened', // Default
              items: [] as any[],
              customerId: null,
              openedAt: null,
              confirmedAt: null,
              cancelledAt: null
            };

            // Process events to build cart summary
            for (const event of jsonData.events) {
              switch (event.type) {
                case 'ShoppingCartOpened':
                  cartSummary.customerId = event.data.customerId;
                  cartSummary.openedAt = event.data.openedAt;
                  cartSummary.status = 'Opened';
                  break;
                case 'ProductItemAddedToShoppingCart':
                  const existingItem = cartSummary.items.find(item =>
                    item.productId === event.data.productItem.productId
                  );
                  if (existingItem) {
                    existingItem.quantity += event.data.productItem.quantity;
                  } else {
                    cartSummary.items.push({
                      productId: event.data.productItem.productId,
                      productName: event.data.productItem.productName,
                      quantity: event.data.productItem.quantity,
                      price: event.data.productItem.unitPrice
                    });
                  }
                  break;
                case 'ProductItemRemovedFromShoppingCart':
                  const itemToRemove = cartSummary.items.find(item =>
                    item.productId === event.data.productItem.productId
                  );
                  if (itemToRemove) {
                    itemToRemove.quantity -= event.data.productItem.quantity;
                    if (itemToRemove.quantity <= 0) {
                      cartSummary.items = cartSummary.items.filter(item =>
                        item.productId !== event.data.productItem.productId
                      );
                    }
                  }
                  break;
                case 'ShoppingCartConfirmed':
                  cartSummary.status = 'Confirmed';
                  cartSummary.confirmedAt = event.data.confirmedAt;
                  break;
                case 'ShoppingCartCancelled':
                  cartSummary.status = 'Cancelled';
                  cartSummary.cancelledAt = event.data.cancelledAt;
                  break;
              }
            }

            carts.push(cartSummary);
          } catch (error) {
            console.warn(`Failed to process ${file}:`, error);
          }
        }
      }

      // Sort by last updated (newest first)
      return carts.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
    } catch (error) {
      console.warn('Failed to get all carts:', error);
      return [];
    }
  };

  return extendedStore;
}

async function loadExistingData(dataDirectory: string, eventStore: EventStore<any>) {
  try {
    const files = await fs.readdir(dataDirectory);

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(dataDirectory, file);
          const data = await fs.readFile(filePath, 'utf-8');
          const jsonData = JSON.parse(data);

          const streamId = jsonData.streamId;
          const events = jsonData.events.map((event: any) => ({
            type: event.type,
            data: event.data
          }));

          if (events.length > 0) {
            await eventStore.appendToStream(streamId, events);
          }
        } catch (error) {
          console.warn(`Failed to load ${file}:`, error);
        }
      }
    }
  } catch (error) {
    // Directory doesn't exist yet, which is fine
  }
}