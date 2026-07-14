import api from './client';
import {
  DashboardStats,
  ActivityPoint,
  RecentOrder,
} from '../types/dashboard';

/**
 * Dashboard statistics
 * GET /api/agent/stats
 */
export async function getStats(): Promise<DashboardStats> {
  const res = await api.get('/agent/stats');

  return res.data.data;
}

/**
 * Hourly activity chart
 * GET /api/agent/activity-graph
 */
export async function getActivityGraph(): Promise<ActivityPoint[]> {
  const res = await api.get('/agent/activity-graph');

  return res.data.data;
}

/**
 * Recent urgent orders
 * GET /api/agent/recent-orders
 */
export async function getRecentOrders(): Promise<RecentOrder[]> {
  const res = await api.get('/agent/recent-orders');

  return res.data.data;
}

/**
 * Load complete dashboard
 */
export async function getDashboard() {
  const [stats, activity, recentOrders] = await Promise.all([
    getStats(),
    getActivityGraph(),
    getRecentOrders(),
  ]);

  return {
    stats,
    activity,
    recentOrders,
  };
}