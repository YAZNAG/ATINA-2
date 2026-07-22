import { useEffect, useState } from "react";

import {
  getStats,
  getActivityGraph,
  getRecentOrders,
} from "../api/dashboard";

export function useDashboard() {
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState<any>();

  const [graph, setGraph] = useState<any[]>([]);

  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  async function refresh() {
    try {
      setLoading(true);

      const [
        s,
        g,
        r,
      ] = await Promise.all([
        getStats(),
        getActivityGraph(),
        getRecentOrders(),
      ]);

      setStats(s);

      setGraph(g);

      setRecentOrders(r);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return {
    loading,
    stats,
    graph,
    recentOrders,
    refresh,
  };
}