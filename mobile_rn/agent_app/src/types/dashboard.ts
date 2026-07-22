export interface DashboardStats {
  pendingOrders: number;
  completedToday: number;
}

export interface ActivityPoint {
  hour: string;
  value: number;
}

export interface RecentOrder {
  id: string;
  customer: string;
  items: number;
  priority: "LOW" | "MEDIUM" | "HIGH";
  createdAt: string;

  status: string;
}

export interface DashboardResponse {
  stats: DashboardStats;
  activity: ActivityPoint[];
  recentOrders: RecentOrder[];
}