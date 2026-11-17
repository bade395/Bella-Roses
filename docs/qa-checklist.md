# Bella Roses — Operational QA Checklist

This checklist separates automated checks from production smoke tests. Production checks must use a clearly identifiable test order and must not alter real customer orders.

## Automated checks

Run before merging:

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`

The order-workflow tests verify legal status transitions, terminal states, and kitchen/service role restrictions.

## Staging / controlled end-to-end flow

1. Open a table QR URL and confirm it resolves to `/menu?table=...`.
2. Add an available product, change quantity, add an item note, and confirm the cart subtotal.
3. Submit an order and record its generated order ID and number.
4. Confirm the order appears in the active admin queue with the correct table, items, and total.
5. Move it through new → accepted → preparing → ready → served.
6. Confirm the customer tracking page reflects each status and the active queue removes the served order.
7. Confirm the served order appears in the archive and in the served-value report.
8. Repeat with a second test order and cancel it; confirm it leaves the active queue and appears in the cancelled archive count.
9. Verify invalid transitions are rejected with HTTP 409 and that served/cancelled orders cannot be reopened.
10. Verify kitchen and service accounts can only perform their permitted transitions.

## Access-control checks

- Signed-out users cannot read admin orders, reports, archive, staff, or table-management APIs.
- A staff account without a permission receives HTTP 403.
- The staff screen shows a loading state until `/api/admin/me` resolves; it must not flash an incorrect permission-denied message.
- Requests that mutate order status must originate from the same site and must follow the transition map.
- The public tracking endpoint returns only the order number, status, table number, subtotal, and creation timestamp.

## Mobile / responsive checks

Test at 360px, 390px, 768px, and desktop widths:

- Menu category navigation and cart controls remain usable without horizontal overflow.
- Customer checkout fields and submit button fit the viewport.
- Admin order cards, status controls, archive table, reports, and staff controls remain readable and operable.
- The kitchen display remains readable in portrait and landscape orientations.

## Production safety

- Do not create, cancel, or serve a production test order without explicit approval.
- Do not send staff invitations or create the Appwrite staff team as part of QA.
- Do not interpret served order value as collected revenue; online payment is not enabled.
