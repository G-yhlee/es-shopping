import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import type { EventStore } from '@event-driven-io/emmett';
import type { ShoppingCartEvent } from '../events/index.js';
import { decide, evolve, initialState } from '../domain/shoppingCart.js';
import type { PricedProductItem } from '../types/index.js';

export type GetProductPrice = (productId: string) => Promise<number | undefined>;

export const shoppingCartApi = (
  eventStore: EventStore<ShoppingCartEvent> & { getAllCarts?: () => Promise<any[]> },
  getProductPrice: GetProductPrice,
  getCurrentTime: () => Date = () => new Date(),
) => {
  const router = Router();

  const handleCommand = async (
    streamId: string,
    command: { type: string; data: any },
    expectedRevision?: bigint,
  ) => {
    // Read current state
    const readResult = await eventStore.readStream(streamId);
    let currentState = initialState();

    for (const event of readResult.events) {
      currentState = evolve(currentState, event as any);
    }

    // Execute command
    const newEvent = decide(command, currentState, { now: getCurrentTime() });

    // Append event
    const appendResult = await eventStore.appendToStream(streamId, [newEvent], {
      expectedStreamVersion: expectedRevision as any,
    });

    return appendResult.nextExpectedStreamVersion;
  };

  router.post('/carts', async (req: Request, res: Response) => {
    try {
      const shoppingCartId = uuid();
      const customerId = req.body.customerId || uuid();

      const command = {
        type: 'OpenShoppingCart',
        data: {
          shoppingCartId,
          customerId,
        },
      };

      const nextRevision = await handleCommand(shoppingCartId, command);

      res.status(201)
        .header('Location', `/carts/${shoppingCartId}`)
        .json({
          id: shoppingCartId,
          customerId,
          status: 'Opened',
          revision: String(nextRevision)
        });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  router.post('/carts/:id/items', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { productId, productName, quantity } = req.body;
      const revisionHeader = req.headers['if-match'] as string | undefined;
      const expectedRevision = revisionHeader ? BigInt(revisionHeader) : undefined;

      const unitPrice = await getProductPrice(productId);
      if (unitPrice === undefined) {
        throw new Error(`Product ${productId} not found`);
      }

      const productItem: PricedProductItem = {
        productId,
        productName,
        quantity,
        unitPrice,
      };

      const command = {
        type: 'AddProductItemToShoppingCart',
        data: {
          shoppingCartId: id,
          productItem,
        },
      };

      const nextRevision = await handleCommand(id, command, expectedRevision);

      res.status(200)
        .json({ message: 'Product added to cart', revision: String(nextRevision) });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  router.delete('/carts/:id/items/:productId', async (req: Request, res: Response) => {
    try {
      const { id, productId } = req.params;
      const { quantity } = req.body;
      const revisionHeader = req.headers['if-match'] as string | undefined;
      const expectedRevision = revisionHeader ? BigInt(revisionHeader) : undefined;

      const command = {
        type: 'RemoveProductItemFromShoppingCart',
        data: {
          shoppingCartId: id,
          productItem: {
            productId,
            quantity: quantity || 1,
          },
        },
      };

      const nextRevision = await handleCommand(id, command, expectedRevision);

      res.status(200)
        .json({ message: 'Product removed from cart', revision: String(nextRevision) });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  router.post('/carts/:id/confirm', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const revisionHeader = req.headers['if-match'] as string | undefined;
      const expectedRevision = revisionHeader ? BigInt(revisionHeader) : undefined;

      const command = {
        type: 'ConfirmShoppingCart',
        data: {
          shoppingCartId: id,
        },
      };

      const nextRevision = await handleCommand(id, command, expectedRevision);

      res.status(200)
        .json({ message: 'Cart confirmed', revision: String(nextRevision) });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  router.post('/carts/:id/cancel', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const revisionHeader = req.headers['if-match'] as string | undefined;
      const expectedRevision = revisionHeader ? BigInt(revisionHeader) : undefined;

      const command = {
        type: 'CancelShoppingCart',
        data: {
          shoppingCartId: id,
        },
      };

      const nextRevision = await handleCommand(id, command, expectedRevision);

      res.status(200)
        .json({ message: 'Cart cancelled', revision: String(nextRevision) });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  router.get('/carts/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const streamResult = await eventStore.readStream(id);
      let currentState = initialState();
      let currentVersion = BigInt(-1);

      for (const event of streamResult.events) {
        currentState = evolve(currentState, event as any);
      }

      // The current version should be the stream version
      currentVersion = streamResult.currentStreamVersion;

      if (streamResult.events.length === 0) {
        return res.status(404).json({ error: 'Cart not found' });
      }

      res.status(200)
        .json({
          ...currentState,
          revision: String(currentVersion)
        });
    } catch (error) {
      res.status(404).json({ error: 'Cart not found' });
    }
  });

  router.get('/carts', async (req: Request, res: Response) => {
    try {
      if (eventStore.getAllCarts) {
        const carts = await eventStore.getAllCarts();
        res.status(200).json(carts);
      } else {
        res.status(200).json([]);
      }
    } catch (error) {
      console.error('Failed to get cart history:', error);
      res.status(500).json({ error: 'Failed to get cart history' });
    }
  });

  // Delete specific cart
  router.delete('/carts/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const fs = await import('fs/promises');
      const path = await import('path');

      const eventFilePath = path.join(process.cwd(), 'data', 'events', `${id}.json`);

      // Check if file exists
      try {
        await fs.access(eventFilePath);
        await fs.unlink(eventFilePath);
        res.status(200).json({ message: 'Cart deleted successfully' });
      } catch (fileError) {
        res.status(404).json({ error: 'Cart not found' });
      }
    } catch (error) {
      console.error('Error deleting cart:', error);
      res.status(500).json({ error: 'Failed to delete cart' });
    }
  });

  // Delete all carts
  router.delete('/carts', async (req: Request, res: Response) => {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      const dataDir = path.join(process.cwd(), 'data', 'events');
      const files = await fs.readdir(dataDir);

      let deletedCount = 0;
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(dataDir, file);
          await fs.unlink(filePath);
          deletedCount++;
        }
      }

      res.status(200).json({
        message: `Successfully deleted ${deletedCount} carts`,
        deletedCount
      });
    } catch (error) {
      console.error('Error deleting all carts:', error);
      res.status(500).json({ error: 'Failed to delete all carts' });
    }
  });

  return router;
};