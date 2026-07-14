import { useEffect, useState } from 'react';
import { getOrders } from '../api/orders';

export function useOrders() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        load();
    }, []);

    async function load() {
        try {
            const data = await getOrders();
            setOrders(data);
        } finally {
            setLoading(false);
        }
    }

    return {
        orders,
        loading,
        refresh: load,
    };
}