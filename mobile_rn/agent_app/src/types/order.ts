export type OrderStatus =
  | "PENDING"
  | "ACCEPTED"
  | "PICKING"
  | "READY"
  | "DELIVERED";

export interface OrderItem {
  id: string;
  article: string;
  quantity: number;
  picked: number;
}

export interface Order {
  id: string;

  customer: string;

  address: string;

  status: OrderStatus;

  totalItems: number;

  createdAt: string;

  items?: OrderItem[];
}