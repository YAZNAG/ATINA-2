export type OrderStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "delivered"
  | "cancelled";

export type paymentMethod = "cash" | "card" | "online";

export type DeliveryType = "delivery" | "pickup";

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  customer: string;
  createdAt: string;

  items: OrderItem[];

  total: number;

  payment: paymentMethod;

  deliveryType: DeliveryType;

  address: string;

  readySince?: string;

  status: OrderStatus;
}