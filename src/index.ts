import express from 'express';
import { getJsonFileEventStore } from './eventStore/jsonFileEventStore.js';
import { shoppingCartApi } from './shoppingCart/api/index.js';
import type { ShoppingCartEvent } from './shoppingCart/events/index.js';

const PORT = process.env.PORT || 3000;

const productCatalog = new Map<string, number>([
  ['product-001', 29.99],
  ['product-002', 49.99],
  ['product-003', 19.99],
  ['product-004', 99.99],
  ['product-005', 149.99],
]);

const getProductPrice = async (productId: string): Promise<number | undefined> => {
  return productCatalog.get(productId);
};

const eventStore = getJsonFileEventStore({ dataDirectory: './data/events' });

const app = express();
app.use(express.json());
app.use(express.static('public'));

app.use('/api', shoppingCartApi(eventStore, getProductPrice));

// Add events endpoint
app.get('/api/events', async (req, res) => {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');

    const dataDir = path.join(process.cwd(), 'data', 'events');
    const files = await fs.readdir(dataDir);
    const eventStreams = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(dataDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const streamData = JSON.parse(content);
        eventStreams.push(streamData);
      }
    }

    res.json(eventStreams);
  } catch (error) {
    console.error('Error loading events:', error);
    res.json([]);
  }
});

app.get('/api', (req, res) => {
  res.json({
    message: 'Shopping Cart Event Sourcing API',
    endpoints: {
      'POST /carts': 'Create a new shopping cart',
      'POST /carts/:id/items': 'Add product to cart',
      'DELETE /carts/:id/items/:productId': 'Remove product from cart',
      'POST /carts/:id/confirm': 'Confirm cart',
      'POST /carts/:id/cancel': 'Cancel cart',
      'GET /carts/:id': 'Get cart details',
      'GET /carts': 'Get all carts',
      'GET /events': 'Get all events',
    },
    sampleProducts: Array.from(productCatalog.entries()).map(([id, price]) => ({
      productId: id,
      price,
    })),
  });
});

app.listen(PORT, () => {
  console.log(`🛒 Shopping Cart API is running on port ${PORT}`);
  console.log(`📚 Visit http://localhost:${PORT} for API documentation`);
});