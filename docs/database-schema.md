# Appwrite Database Schema

Database ID: `bella_roses`

## Tables

### `categories`
Bilingual menu category.
- `name_ar`, `name_en` — required localized names
- `description_ar`, `description_en` — optional localized descriptions
- `image_id` — optional Storage file ID
- `is_active` — defaults to true
- `sort_order` — defaults to 0

Access: public read only. Writes are reserved for authenticated administration.

### `products`
Bilingual menu product.
- `category_id` — references `categories.$id`
- `name_ar`, `name_en` — required localized names
- `description_ar`, `description_en` — optional localized descriptions
- `price` — required non-negative amount in SAR
- `image_id` — optional Storage file ID
- `is_available` — defaults to true
- `is_featured` — defaults to false
- `sort_order` — defaults to 0

Access: public read only. Writes are reserved for authenticated administration.

### `restaurant_tables`
Physical table and QR identity.
- `table_number` — required, unique, positive integer
- `label` — optional display label
- `qr_token` — required unique opaque token; never use sequential table IDs in QR URLs
- `is_active` — defaults to true

Access: private. Public QR resolution must happen through a server endpoint that validates the token and returns only safe table context.

### `orders`
Table order header.
- `order_number` — required and unique
- `table_id` — references `restaurant_tables.$id`
- `status` — new, accepted, preparing, ready, served, cancelled
- `subtotal` — required non-negative amount
- `customer_name`, `notes` — optional

Access: private. Order creation and status changes must be server-side and validated.

### `order_items`
Immutable product snapshot for an order.
- `order_id` — references `orders.$id`
- `product_id` — references `products.$id`
- `product_name_ar`, `product_name_en` — names captured at order time
- `unit_price`, `quantity`, `line_total` — required
- `notes` — optional

Access: private. Server-side order creation computes prices from trusted product records; never trust client-supplied totals.

### `restaurant_settings`
Single restaurant configuration row.
- `restaurant_name_ar`, `restaurant_name_en` — required
- `phone` — optional
- `currency` — defaults to SAR
- `logo_file_id` — optional Storage file ID
- `ordering_enabled` — defaults to true

Access: private. Public-safe branding will be exposed through a server endpoint.

## Storage

Bucket ID: `menu_images`
- Public read only
- Anonymous writes disabled
- Allowed extensions: JPG, JPEG, PNG, WebP, AVIF
- Encryption and antivirus scanning enabled
- Image transformations enabled
- Metadata stripping enabled

## Security invariants

1. Never put an Appwrite API key in a `NEXT_PUBLIC_*` variable or browser bundle.
2. Public clients may read only the menu tables and menu images.
3. Guests must not directly create or mutate order rows.
4. The server validates QR tokens, table status, product availability and current prices.
5. Order item names and prices are snapshots so later menu edits do not rewrite order history.
6. Payment processing is not implemented in this phase.
