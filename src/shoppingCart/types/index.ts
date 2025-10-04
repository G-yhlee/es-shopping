export type ProductItem = {
  productId: string;
  productName: string;
  quantity: number;
};

export type PricedProductItem = ProductItem & {
  unitPrice: number;
};

export type ShoppingCartStatus = 'Opened' | 'Confirmed' | 'Cancelled';

export type ShoppingCart = {
  id: string;
  customerId: string;
  status: ShoppingCartStatus;
  items: PricedProductItem[];
  openedAt: Date;
  confirmedAt?: Date;
  cancelledAt?: Date;
};

export type ShoppingCartSummary = {
  id: string;
  customerId: string;
  status: ShoppingCartStatus;
  items: PricedProductItem[];
  totalAmount: number;
  totalItemsCount: number;
  openedAt: Date;
  confirmedAt?: Date;
  cancelledAt?: Date;
};