import { CommandHandler } from '@event-driven-io/emmett';
import { evolve, initialState } from './shoppingCart.js';
import type { ShoppingCart } from '../types/index.js';
import type { ShoppingCartEvent } from '../events/index.js';

export const handle = CommandHandler<ShoppingCart, ShoppingCartEvent>({
  evolve,
  initialState: initialState,
});