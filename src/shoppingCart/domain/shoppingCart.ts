import { IllegalStateError } from '@event-driven-io/emmett';
import type { ShoppingCart, PricedProductItem, ProductItem } from '../types/index.js';
import type {
  ShoppingCartOpened,
  ProductItemAddedToShoppingCart,
  ProductItemRemovedFromShoppingCart,
  ShoppingCartConfirmed,
  ShoppingCartCancelled,
  ShoppingCartEvent,
} from '../events/index.js';
import type {
  OpenShoppingCart,
  AddProductItemToShoppingCart,
  RemoveProductItemFromShoppingCart,
  ConfirmShoppingCart,
  CancelShoppingCart,
} from '../commands/index.js';

export const initialState = (): ShoppingCart => ({
  id: '',
  customerId: '',
  status: 'Opened',
  items: [],
  openedAt: new Date(),
});

export const openShoppingCart = (
  command: OpenShoppingCart,
  state: ShoppingCart,
  metadata?: { now?: Date },
): ShoppingCartOpened => {
  if (state.id !== '') {
    throw new IllegalStateError('Shopping cart already exists');
  }

  return {
    type: 'ShoppingCartOpened',
    data: {
      shoppingCartId: command.data.shoppingCartId,
      customerId: command.data.customerId,
      openedAt: metadata?.now ?? new Date(),
    },
  };
};

export const addProductItem = (
  command: AddProductItemToShoppingCart,
  state: ShoppingCart,
  metadata?: { now?: Date },
): ProductItemAddedToShoppingCart => {
  if (state.status !== 'Opened') {
    throw new IllegalStateError('Cannot add product to a closed shopping cart');
  }

  return {
    type: 'ProductItemAddedToShoppingCart',
    data: {
      shoppingCartId: command.data.shoppingCartId,
      productItem: command.data.productItem,
      addedAt: metadata?.now ?? new Date(),
    },
  };
};

export const removeProductItem = (
  command: RemoveProductItemFromShoppingCart,
  state: ShoppingCart,
  metadata?: { now?: Date },
): ProductItemRemovedFromShoppingCart => {
  if (state.status !== 'Opened') {
    throw new IllegalStateError('Cannot remove product from a closed shopping cart');
  }

  const existingItem = state.items.find(
    (item) => item.productId === command.data.productItem.productId,
  );

  if (!existingItem) {
    throw new IllegalStateError('Product item not found in shopping cart');
  }

  if (existingItem.quantity < command.data.productItem.quantity) {
    throw new IllegalStateError('Cannot remove more items than available in cart');
  }

  return {
    type: 'ProductItemRemovedFromShoppingCart',
    data: {
      shoppingCartId: command.data.shoppingCartId,
      productItem: command.data.productItem,
      removedAt: metadata?.now ?? new Date(),
    },
  };
};

export const confirmShoppingCart = (
  command: ConfirmShoppingCart,
  state: ShoppingCart,
  metadata?: { now?: Date },
): ShoppingCartConfirmed => {
  if (state.status !== 'Opened') {
    throw new IllegalStateError('Cannot confirm a shopping cart that is not open');
  }

  if (state.items.length === 0) {
    throw new IllegalStateError('Cannot confirm an empty shopping cart');
  }

  return {
    type: 'ShoppingCartConfirmed',
    data: {
      shoppingCartId: command.data.shoppingCartId,
      confirmedAt: metadata?.now ?? new Date(),
    },
  };
};

export const cancelShoppingCart = (
  command: CancelShoppingCart,
  state: ShoppingCart,
  metadata?: { now?: Date },
): ShoppingCartCancelled => {
  if (state.status !== 'Opened') {
    throw new IllegalStateError('Cannot cancel a shopping cart that is not open');
  }

  return {
    type: 'ShoppingCartCancelled',
    data: {
      shoppingCartId: command.data.shoppingCartId,
      cancelledAt: metadata?.now ?? new Date(),
    },
  };
};

const mergeProductItems = (
  items: PricedProductItem[],
  productItem: PricedProductItem,
): PricedProductItem[] => {
  const existingIndex = items.findIndex(
    (item) => item.productId === productItem.productId,
  );

  if (existingIndex >= 0) {
    const updatedItems = [...items];
    updatedItems[existingIndex] = {
      ...updatedItems[existingIndex],
      quantity: updatedItems[existingIndex].quantity + productItem.quantity,
    };
    return updatedItems;
  }

  return [...items, productItem];
};

const removeProductItems = (
  items: PricedProductItem[],
  productItem: ProductItem,
): PricedProductItem[] => {
  const existingIndex = items.findIndex(
    (item) => item.productId === productItem.productId,
  );

  if (existingIndex < 0) {
    return items;
  }

  const existingItem = items[existingIndex];
  const newQuantity = existingItem.quantity - productItem.quantity;

  if (newQuantity <= 0) {
    return items.filter((_, index) => index !== existingIndex);
  }

  const updatedItems = [...items];
  updatedItems[existingIndex] = {
    ...existingItem,
    quantity: newQuantity,
  };
  return updatedItems;
};

export const evolve = (
  state: ShoppingCart,
  { type, data: event }: ShoppingCartEvent,
): ShoppingCart => {
  switch (type) {
    case 'ShoppingCartOpened':
      return {
        id: event.shoppingCartId,
        customerId: event.customerId,
        status: 'Opened',
        items: [],
        openedAt: event.openedAt,
      };

    case 'ProductItemAddedToShoppingCart':
      return {
        ...state,
        items: mergeProductItems(state.items, event.productItem),
      };

    case 'ProductItemRemovedFromShoppingCart':
      return {
        ...state,
        items: removeProductItems(state.items, event.productItem),
      };

    case 'ShoppingCartConfirmed':
      return {
        ...state,
        status: 'Confirmed',
        confirmedAt: event.confirmedAt,
      };

    case 'ShoppingCartCancelled':
      return {
        ...state,
        status: 'Cancelled',
        cancelledAt: event.cancelledAt,
      };

    default:
      return state;
  }
};

export const decide = (
  command: { type: string; data: any },
  state: ShoppingCart,
  metadata?: { now?: Date },
): ShoppingCartEvent => {
  switch (command.type) {
    case 'OpenShoppingCart':
      return openShoppingCart(command as OpenShoppingCart, state, metadata);
    case 'AddProductItemToShoppingCart':
      return addProductItem(command as AddProductItemToShoppingCart, state, metadata);
    case 'RemoveProductItemFromShoppingCart':
      return removeProductItem(command as RemoveProductItemFromShoppingCart, state, metadata);
    case 'ConfirmShoppingCart':
      return confirmShoppingCart(command as ConfirmShoppingCart, state, metadata);
    case 'CancelShoppingCart':
      return cancelShoppingCart(command as CancelShoppingCart, state, metadata);
    default:
      throw new Error(`Unknown command type: ${command.type}`);
  }
};