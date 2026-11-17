export const ORDER_TRANSITIONS = Object.freeze({
  new: Object.freeze(["accepted", "cancelled"]),
  accepted: Object.freeze(["preparing", "cancelled"]),
  preparing: Object.freeze(["ready", "cancelled"]),
  ready: Object.freeze(["served", "cancelled"]),
  served: Object.freeze([]),
  cancelled: Object.freeze([]),
});

const ROLE_TRANSITIONS = Object.freeze({
  kitchen: new Set(["accepted", "preparing", "ready"]),
  service: new Set(["served", "cancelled"]),
});

export function getAllowedNextStatuses(currentStatus, role) {
  const next = ORDER_TRANSITIONS[currentStatus] ?? [];
  if (role === "service" && currentStatus !== "ready") return [];
  const roleAllowed = ROLE_TRANSITIONS[role];
  return roleAllowed ? next.filter((status) => roleAllowed.has(status)) : [...next];
}
