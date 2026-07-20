import React from "react";
import PendingOrderCard from "./PendingOrderCard";
import ReadyOrderCard from "./ReadyOrderCard";
import type { Order } from "@/types/order";

interface OrderCardProps {

    order: Order;

    onPrepare: () => void;

    onViewDetails: () => void;

}
export default function OrderCard({
    order,
    onPrepare,
    onViewDetails,
}: OrderCardProps) {

    if (order.status === "ready") {
        return (
            <ReadyOrderCard
                order={order}
                onViewDetails={onViewDetails}
            />
        );
    }

    return (
        <PendingOrderCard
            order={order}
            onPrepare={onPrepare}
            onViewDetails={onViewDetails}
        />
    );
}
