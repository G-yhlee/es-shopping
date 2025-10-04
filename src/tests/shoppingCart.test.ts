import { describe, it } from 'vitest';
import { DeciderSpecification } from '@event-driven-io/emmett';
import { decide, evolve, initialState } from '../shoppingCart/domain/shoppingCart.js';
import type { ShoppingCartEvent } from '../shoppingCart/events/index.js';
import type { PricedProductItem } from '../shoppingCart/types/index.js';
import type { ShoppingCart } from '../shoppingCart/types/index.js';

const given = DeciderSpecification.for<ShoppingCart, ShoppingCartEvent, any>({
  decide,
  evolve,
  initialState,
});

describe('ShoppingCart', () => {
  const shoppingCartId = 'cart-123';
  const customerId = 'customer-456';
  const now = new Date('2024-01-01T10:00:00Z');

  const productItem: PricedProductItem = {
    productId: 'product-789',
    productName: 'Test Product',
    quantity: 2,
    unitPrice: 25.00,
  };

  const anotherProductItem: PricedProductItem = {
    productId: 'product-999',
    productName: 'Another Product',
    quantity: 1,
    unitPrice: 50.00,
  };

  describe('When cart does not exist', () => {
    it('should open a new shopping cart', () => {
      given([])
        .when({
          type: 'OpenShoppingCart',
          data: {
            shoppingCartId,
            customerId,
          },
        }, { now })
        .then([
          {
            type: 'ShoppingCartOpened',
            data: {
              shoppingCartId,
              customerId,
              openedAt: now,
            },
          },
        ]);
    });
  });

  describe('When cart is opened', () => {
    const opened: ShoppingCartEvent = {
      type: 'ShoppingCartOpened',
      data: {
        shoppingCartId,
        customerId,
        openedAt: now,
      },
    };

    it('should add a product item', () => {
      given([opened])
        .when({
          type: 'AddProductItemToShoppingCart',
          data: {
            shoppingCartId,
            productItem,
          },
        }, { now })
        .then([
          {
            type: 'ProductItemAddedToShoppingCart',
            data: {
              shoppingCartId,
              productItem,
              addedAt: now,
            },
          },
        ]);
    });

    it('should add multiple different products', () => {
      const productAdded: ShoppingCartEvent = {
        type: 'ProductItemAddedToShoppingCart',
        data: {
          shoppingCartId,
          productItem,
          addedAt: now,
        },
      };

      given([opened, productAdded])
        .when({
          type: 'AddProductItemToShoppingCart',
          data: {
            shoppingCartId,
            productItem: anotherProductItem,
          },
        }, { now })
        .then([
          {
            type: 'ProductItemAddedToShoppingCart',
            data: {
              shoppingCartId,
              productItem: anotherProductItem,
              addedAt: now,
            },
          },
        ]);
    });

    it('should remove a product item', () => {
      const productAdded: ShoppingCartEvent = {
        type: 'ProductItemAddedToShoppingCart',
        data: {
          shoppingCartId,
          productItem,
          addedAt: now,
        },
      };

      given([opened, productAdded])
        .when({
          type: 'RemoveProductItemFromShoppingCart',
          data: {
            shoppingCartId,
            productItem: {
              productId: productItem.productId,
              productName: productItem.productName,
              quantity: 1,
            },
          },
        }, { now })
        .then([
          {
            type: 'ProductItemRemovedFromShoppingCart',
            data: {
              shoppingCartId,
              productItem: {
                productId: productItem.productId,
                productName: productItem.productName,
                quantity: 1,
              },
              removedAt: now,
            },
          },
        ]);
    });

    it('should not remove a product that does not exist', () => {
      given([opened])
        .when({
          type: 'RemoveProductItemFromShoppingCart',
          data: {
            shoppingCartId,
            productItem: {
              productId: 'non-existent',
              productName: 'Non-existent Product',
              quantity: 1,
            },
          },
        }, { now })
        .thenThrows();
    });

    it('should confirm cart with items', () => {
      const productAdded: ShoppingCartEvent = {
        type: 'ProductItemAddedToShoppingCart',
        data: {
          shoppingCartId,
          productItem,
          addedAt: now,
        },
      };

      given([opened, productAdded])
        .when({
          type: 'ConfirmShoppingCart',
          data: {
            shoppingCartId,
          },
        }, { now })
        .then([
          {
            type: 'ShoppingCartConfirmed',
            data: {
              shoppingCartId,
              confirmedAt: now,
            },
          },
        ]);
    });

    it('should not confirm empty cart', () => {
      given([opened])
        .when({
          type: 'ConfirmShoppingCart',
          data: {
            shoppingCartId,
          },
        }, { now })
        .thenThrows();
    });

    it('should cancel cart', () => {
      given([opened])
        .when({
          type: 'CancelShoppingCart',
          data: {
            shoppingCartId,
          },
        }, { now })
        .then([
          {
            type: 'ShoppingCartCancelled',
            data: {
              shoppingCartId,
              cancelledAt: now,
            },
          },
        ]);
    });
  });

  describe('When cart is confirmed', () => {
    const opened: ShoppingCartEvent = {
      type: 'ShoppingCartOpened',
      data: {
        shoppingCartId,
        customerId,
        openedAt: now,
      },
    };

    const productAdded: ShoppingCartEvent = {
      type: 'ProductItemAddedToShoppingCart',
      data: {
        shoppingCartId,
        productItem,
        addedAt: now,
      },
    };

    const confirmed: ShoppingCartEvent = {
      type: 'ShoppingCartConfirmed',
      data: {
        shoppingCartId,
        confirmedAt: now,
      },
    };

    it('should not add product to confirmed cart', () => {
      given([opened, productAdded, confirmed])
        .when({
          type: 'AddProductItemToShoppingCart',
          data: {
            shoppingCartId,
            productItem: anotherProductItem,
          },
        }, { now })
        .thenThrows();
    });

    it('should not confirm already confirmed cart', () => {
      given([opened, productAdded, confirmed])
        .when({
          type: 'ConfirmShoppingCart',
          data: {
            shoppingCartId,
          },
        }, { now })
        .thenThrows();
    });

    it('should not cancel confirmed cart', () => {
      given([opened, productAdded, confirmed])
        .when({
          type: 'CancelShoppingCart',
          data: {
            shoppingCartId,
          },
        }, { now })
        .thenThrows();
    });
  });
});