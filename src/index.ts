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