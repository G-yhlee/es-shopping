import type { ShoppingCartSummary, PricedProductItem, ProductItem } from '../types/index.js';
import type { ShoppingCartEvent } from '../events/index.js';

const calculateTotals = (items: PricedProductItem[]) => {
  return items.reduce(
    (totals, item) => ({
      totalAmount: totals.totalAmount + item.unitPrice * item.quantity,
      totalItemsCount: totals.totalItemsCount + item.quantity,
    }),
    { totalAmount: 0, totalItemsCount: 0 },
  );
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

export const evolveShoppingCartSummary = (
  document: ShoppingCartSummary | null,
  { type, data: event }: ShoppingCartEvent,
): ShoppingCartSummary | null => {
  switch (type) {
    case 'ShoppingCartOpened':
      return {
        id: event.shoppingCartId,
        customerId: event.customerId,
        status: 'Opened',
        items: [],
        totalAmount: 0,
        totalItemsCount: 0,
        openedAt: event.openedAt,
      };

    case 'ProductItemAddedToShoppingCart': {
      if (!document) return null;
      const updatedItems = mergeProductItems(document.items, event.productItem);
      const totals = calculateTotals(updatedItems);
      return {
        ...document,
        items: updatedItems,
        ...totals,
      };
    }

    case 'ProductItemRemovedFromShoppingCart': {
      if (!document) return null;
      const updatedItems = removeProductItems(document.items, event.productItem);
      const totals = calculateTotals(updatedItems);
      return {
        ...document,
        items: updatedItems,
        ...totals,
      };
    }

    case 'ShoppingCartConfirmed':
      if (!document) return null;
      return {
        ...document,
        status: 'Confirmed',
        confirmedAt: event.confirmedAt,
      };

    case 'ShoppingCartCancelled':
      if (!document) return null;
      return {
        ...document,
        status: 'Cancelled',
        cancelledAt: event.cancelledAt,
      };

    default:
      return document;
  }
};