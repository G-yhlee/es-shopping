import type { ShoppingCartEvent } from '../events/index.js';

export type CustomerShoppingSummary = {
  customerId: string;
  totalCarts: number;
  activeCartsCount: number;
  confirmedCartsCount: number;
  cancelledCartsCount: number;
  totalSpent: number;
  lastActivityAt: Date;
  carts: {
    id: string;
    status: string;
    totalAmount: number;
    openedAt: Date;
  }[];
};

export const evolveCustomerShoppingSummary = (
  document: CustomerShoppingSummary | null,
  { type, data: event }: ShoppingCartEvent,
  streamId: string,
): CustomerShoppingSummary | null => {
  switch (type) {
    case 'ShoppingCartOpened': {
      const existing = document ?? {
        customerId: event.customerId,
        totalCarts: 0,
        activeCartsCount: 0,
        confirmedCartsCount: 0,
        cancelledCartsCount: 0,
        totalSpent: 0,
        lastActivityAt: event.openedAt,
        carts: [],
      };

      return {
        ...existing,
        totalCarts: existing.totalCarts + 1,
        activeCartsCount: existing.activeCartsCount + 1,
        lastActivityAt: event.openedAt,
        carts: [
          ...existing.carts,
          {
            id: event.shoppingCartId,
            status: 'Opened',
            totalAmount: 0,
            openedAt: event.openedAt,
          },
        ],
      };
    }

    case 'ProductItemAddedToShoppingCart': {
      if (!document) return null;
      const cartIndex = document.carts.findIndex(
        (cart) => cart.id === event.shoppingCartId,
      );
      if (cartIndex < 0) return document;

      const updatedCarts = [...document.carts];
      updatedCarts[cartIndex] = {
        ...updatedCarts[cartIndex],
        totalAmount:
          updatedCarts[cartIndex].totalAmount +
          event.productItem.unitPrice * event.productItem.quantity,
      };

      return {
        ...document,
        carts: updatedCarts,
        lastActivityAt: event.addedAt,
      };
    }

    case 'ProductItemRemovedFromShoppingCart': {
      if (!document) return null;
      return {
        ...document,
        lastActivityAt: event.removedAt,
      };
    }

    case 'ShoppingCartConfirmed': {
      if (!document) return null;
      const cartIndex = document.carts.findIndex(
        (cart) => cart.id === event.shoppingCartId,
      );
      if (cartIndex < 0) return document;

      const cart = document.carts[cartIndex];
      const updatedCarts = [...document.carts];
      updatedCarts[cartIndex] = {
        ...cart,
        status: 'Confirmed',
      };

      return {
        ...document,
        activeCartsCount: document.activeCartsCount - 1,
        confirmedCartsCount: document.confirmedCartsCount + 1,
        totalSpent: document.totalSpent + cart.totalAmount,
        carts: updatedCarts,
        lastActivityAt: event.confirmedAt,
      };
    }

    case 'ShoppingCartCancelled': {
      if (!document) return null;
      const cartIndex = document.carts.findIndex(
        (cart) => cart.id === event.shoppingCartId,
      );
      if (cartIndex < 0) return document;

      const updatedCarts = [...document.carts];
      updatedCarts[cartIndex] = {
        ...updatedCarts[cartIndex],
        status: 'Cancelled',
      };

      return {
        ...document,
        activeCartsCount: document.activeCartsCount - 1,
        cancelledCartsCount: document.cancelledCartsCount + 1,
        carts: updatedCarts,
        lastActivityAt: event.cancelledAt,
      };
    }

    default:
      return document;
  }
};