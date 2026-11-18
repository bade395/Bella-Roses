# bade3 7.1 — Logical Database Schema

**Status:** Approved logical design; current physical deployment uses the free-tier shared database  
**Current database ID:** `bella_roses`  
**Future:** Tenant storage placement supports moving a tenant to a dedicated database/project when commercially justified.

> This catalog defines the target logical model. Some Stage 7 platform tables and tenant ownership columns have now been provisioned additively in `bella_roses`; see `docs/bade3-free-tier-live-schema.md` for the verified live inventory. Other modules remain planned and must be provisioned only as their application features are implemented.

## 1. Data ownership conventions

Tables are classified as:
- **Platform-owned:** platform configuration and administration.
- **Tenant-owned:** records belonging to one company.
- **Branch-owned:** operational records belonging to one tenant branch.
- **Child records:** records whose ownership is inherited from a validated parent, with tenant scoping retained wherever practical.

Common fields where applicable:
- `tenant_id`
- `branch_id`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`

Use Appwrite system timestamps where appropriate. Store timestamps consistently in UTC. Store money as integer minor units or a rigorously defined decimal representation; do not use floating-point arithmetic for financial calculations.

## 2. Platform core

### `platform_admins` — platform-owned
- `user_id`
- `role`
- `is_active`
- `permissions`
- `created_at`
- `updated_at`

Only authorized platform administration may grant platform privileges.

### `tenants` — platform-owned
- `name`, `slug`, `legal_name`
- `contact_email`, `contact_phone`
- `country_code`, `timezone`, `default_currency`
- `status`, `plan_id`, `onboarding_source`
- `created_at`, `updated_at`

Tenant states: `pending`, `active`, `suspended`, `cancelled`, `archived`.

### `tenant_members` — tenant-owned
- `tenant_id`, `user_id`, `role`, `status`
- `invited_by`, `joined_at`, `created_at`

### `tenant_settings` — tenant-owned
- `tenant_id`, `language_default`, `timezone`, `currency`
- `tax_configuration`, `order_settings`, `notification_settings`
- `created_at`, `updated_at`

### `branches` — tenant-owned
- `tenant_id`, `name`, `code`, `address`, `phone`
- `timezone`, `currency`, `status`, `is_default`
- `created_at`, `updated_at`

### `branch_staff_access` — tenant/branch-owned
- `tenant_id`, `branch_id`, `user_id`, `role`, `status`, `created_at`

### `tenant_branding` — tenant-owned
- `tenant_id`, `logo_asset_id`, `primary_color`, `secondary_color`
- `accent_color`, `font_family`, `restaurant_display_name`
- `brand_configuration`, `updated_at`

### `branding_assets` — tenant-owned
- `tenant_id`, `asset_type`, `storage_file_id`
- `file_name`, `mime_type`, `created_at`

## 3. Subscription and billing

### `plans` — platform-owned
- `name`, `code`, `description`, `price`
- `billing_period`, `is_active`, `sort_order`

### `plan_features` — platform-owned
- `plan_id`, `feature_key`, `is_enabled`, `feature_limit`, `configuration`

### `subscriptions` — tenant-owned
- `tenant_id`, `plan_id`, `status`, `starts_at`, `ends_at`
- `trial_ends_at`, `billing_period`, `created_at`, `updated_at`

### `subscription_limits` — tenant-owned
- `tenant_id`, `feature_key`, `limit_value`, `effective_from`, `effective_until`

### `subscription_usage` — tenant-owned
- `tenant_id`, `feature_key`, `period_key`, `usage_value`, `updated_at`

### `invoices` — tenant-owned
- `tenant_id`, `subscription_id`, `invoice_number`, `amount`, `currency`
- `status`, `issued_at`, `due_at`, `paid_at`

### `billing_transactions` — tenant-owned
- `tenant_id`, `subscription_id`, `invoice_id`, `provider`
- `provider_reference`, `amount`, `currency`, `status`, `created_at`

Payment gateway integration is deferred. These tables define a future billing model only.

## 4. Domains

### `tenant_domains` — tenant-owned, platform-controlled lifecycle
- `tenant_id`, `domain`, `domain_type`
- `verification_status`, `deployment_status`
- `is_primary`, `is_active`, `verified_at`, `created_at`

### `domain_verifications` — tenant-owned
- `tenant_id`, `domain_id`, `verification_method`
- `verification_token_hash`, `expires_at`, `verified_at`, `created_at`

Store only a hash of verification tokens. Tenants may request domains; only the Platform Owner may approve, activate, suspend, or remove mappings.

## 5. Menu and catalog

### `categories`
- `tenant_id`, `name_ar`, `name_en`
- `description_ar`, `description_en`, `image_id`
- `is_active`, `sort_order`, timestamps

### `products`
- `tenant_id`, `category_id`, `name_ar`, `name_en`
- `description_ar`, `description_en`, `price`, `image_id`
- `is_available`, `is_featured`, `sort_order`, timestamps

### `product_variants`
- `tenant_id`, `product_id`, `name_ar`, `name_en`
- `price_delta`, `is_active`, `sort_order`

### `modifier_groups`
- `tenant_id`, `name_ar`, `name_en`, `selection_type`
- `min_selections`, `max_selections`, `is_required`, `is_active`

### `modifier_options`
- `tenant_id`, `group_id`, `name_ar`, `name_en`
- `price_delta`, `is_active`, `sort_order`

### `product_modifier_groups`
- `tenant_id`, `product_id`, `modifier_group_id`, `sort_order`

## 6. Tables and orders

### `restaurant_tables`
- `tenant_id`, `branch_id`, `table_number`, `label`
- `qr_token`, `is_active`, `created_at`

### `table_sessions`
- `tenant_id`, `branch_id`, `table_id`, `session_token`
- `status`, `opened_at`, `closed_at`

### `orders`
- `tenant_id`, `branch_id`, `table_id`, `table_session_id`
- `order_number`, `status`, `subtotal`, `tax_amount`
- `discount_amount`, `total_amount`, `customer_name`, `customer_phone`
- `notes`, `created_at`, `updated_at`, `served_at`, `cancelled_at`

### `order_items`
- `tenant_id`, `branch_id`, `order_id`, `product_id`
- `product_name_ar`, `product_name_en`
- `unit_price`, `quantity`, `line_total`, `notes`, `created_at`

### `order_item_modifiers`
- `tenant_id`, `order_id`, `order_item_id`
- `modifier_group_id`, `modifier_option_id`
- `name_snapshot`, `price_snapshot`, `quantity`

Order creation and totals are computed server-side. Product names and prices are immutable snapshots for historical orders. Served and cancelled orders leave the active queue but remain in history. State transitions must be validated, and duplicate submissions protected by idempotency keys.

## 7. Inventory

### `inventory_items`
- `tenant_id`, `branch_id`, `name`, `sku`, `unit`
- `minimum_quantity`, `is_active`

### `recipes`
- `tenant_id`, `product_id`, `name`, `is_active`

### `recipe_items`
- `tenant_id`, `recipe_id`, `inventory_item_id`, `quantity_required`

### `inventory_balances`
- `tenant_id`, `branch_id`, `inventory_item_id`, `quantity_on_hand`, `updated_at`

### `inventory_transactions`
- `tenant_id`, `branch_id`, `inventory_item_id`, `transaction_type`
- `quantity`, `reference_type`, `reference_id`
- `idempotency_key`, `created_by`, `created_at`

Inventory changes are recorded as transactions. Historical transactions are not overwritten. Corrections use compensating transactions. Order deductions must be idempotent.

## 8. Kitchen Display System

### `kitchen_stations`
- `tenant_id`, `branch_id`, `name`, `station_type`, `is_active`

### `kitchen_tickets`
- `tenant_id`, `branch_id`, `order_id`, `station_id`
- `status`, `priority`, `created_at`, `started_at`, `completed_at`

### `kitchen_ticket_items`
- `tenant_id`, `branch_id`, `ticket_id`, `order_item_id`
- `quantity`, `status`, `notes`

## 9. Offers, customers, loyalty

### `promotions`
- `tenant_id`, `name`, `description`, `promotion_type`
- `discount_value`, `starts_at`, `ends_at`, `is_active`

### `coupons`
- `tenant_id`, `promotion_id`, `code`, `usage_limit`
- `usage_count`, `expires_at`, `is_active`

### `promotion_redemptions`
- `tenant_id`, `branch_id`, `promotion_id`, `coupon_id`
- `order_id`, `customer_id`, `discount_amount`, `redeemed_at`

### `customers`
- `tenant_id`, `name`, `phone`, `email`
- `preferred_language`, `created_at`

### `loyalty_accounts`
- `tenant_id`, `customer_id`, `points_balance`, `tier`, `updated_at`

### `loyalty_transactions`
- `tenant_id`, `customer_id`, `transaction_type`, `points`
- `reference_type`, `reference_id`, `created_at`

## 10. Analytics and audit

### `analytics_daily`
- `tenant_id`, `branch_id`, `date_key`
- `orders_count`, `gross_sales`, `net_sales`
- `cancelled_orders`, `average_order_value`, `updated_at`

### `analytics_events`
- `tenant_id`, `branch_id`, `event_type`, `event_reference`
- `event_payload`, `occurred_at`

### `audit_events`
- `actor_type`, `actor_id`, `tenant_id`, `branch_id`
- `action`, `resource_type`, `resource_id`, `result`
- `ip_address`, `user_agent`, `metadata`, `created_at`

Audit events are append-only at application level. Tenant users cannot edit or delete audit history. Record Platform Owner access, permission changes, domain/subscription operations, failed privileged actions, and sensitive administrative activity.

## 11. Logical relationships

- `tenants` 1:N `tenant_members`
- `tenants` 1:N `branches`
- `tenants` 1:N `tenant_branding`
- `tenants` 1:N `tenant_domains`
- `tenants` 1:N `subscriptions`
- `plans` 1:N `plan_features`
- `branches` 1:N `branch_staff_access`
- `branches` 1:N `restaurant_tables`
- `branches` 1:N `orders`
- `categories` 1:N `products`
- `products` 1:N `product_variants`
- `products` N:N `modifier_groups` through `product_modifier_groups`
- `orders` 1:N `order_items`
- `order_items` 1:N `order_item_modifiers`
- `orders` 1:N `kitchen_tickets`
- `inventory_items` 1:N `inventory_transactions`
- `products` 1:N `recipes`
- `recipes` 1:N `recipe_items`
- `customers` 1:N `loyalty_transactions`

Appwrite TablesDB does not enforce conventional foreign keys or SQL-style cross-table transactions. Validate all relationships in trusted server code. Parent and child records must belong to the same tenant; branch records must reference a branch belonging to that tenant.

## 12. Index strategy

Validate actual Appwrite index capabilities and query patterns before provisioning.

| Table | Recommended indexed fields |
|---|---|
| `tenants` | `slug`, `status` |
| `tenant_members` | `tenant_id`, `user_id`, `status` |
| `branches` | `tenant_id`, `code`, `status` |
| `branch_staff_access` | `tenant_id`, `branch_id`, `user_id` |
| `tenant_domains` | `domain`, `tenant_id`, `verification_status` |
| `subscriptions` | `tenant_id`, `status`, `ends_at` |
| `subscription_usage` | `tenant_id`, `feature_key`, `period_key` |
| `categories` | `tenant_id`, `is_active`, `sort_order` |
| `products` | `tenant_id`, `category_id`, `is_available` |
| `restaurant_tables` | `tenant_id`, `branch_id`, `table_number`, `qr_token` |
| `orders` | `tenant_id`, `branch_id`, `status`, `created_at` |
| `order_items` | `tenant_id`, `order_id` |
| `inventory_balances` | `tenant_id`, `branch_id`, `inventory_item_id` |
| `inventory_transactions` | `tenant_id`, `branch_id`, `inventory_item_id`, `created_at` |
| `kitchen_tickets` | `tenant_id`, `branch_id`, `status`, `created_at` |
| `customers` | `tenant_id`, `phone`, `email` |
| `audit_events` | `tenant_id`, `actor_id`, `action`, `created_at` |

Where supported, enforce uniqueness for tenant slug, normalized domain, tenant+branch code, tenant+branch+table number, QR token, tenant+order number, tenant+coupon code, and scoped idempotency keys.

## 13. Storage convention

Recommended object path:

`tenants/{tenant_id}/{asset_type}/{file_id}`

Validate tenant ownership before private asset access. Public assets must be explicitly designated; knowledge of a file identifier must not grant private access.
