export type StaffOrderRole = "owner" | "manager" | "cashier" | "kitchen" | "service";
export type OrderStatus = "new" | "accepted" | "preparing" | "ready" | "served" | "cancelled";
export const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>>;
export function getAllowedNextStatuses(currentStatus: string, role: StaffOrderRole | string): OrderStatus[];
