# Bella Roses

Luxury digital menu and smart restaurant management system.

## Technology
- Next.js App Router
- TypeScript (strict mode)
- Tailwind CSS
- Appwrite Cloud TablesDB, Storage and Auth
- Vercel hosting

## Requirements
- Node.js 24+
- npm

## Getting started
1. Clone the repository.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env.local` and confirm the Appwrite settings.
4. Start the development server with `npm run dev`.

## Appwrite resources
Project: `6afac57c0019b2ee5fa0`

Database: `bella_roses`

Tables: `categories`, `products`, `restaurant_tables`, `orders`, `order_items`, and `restaurant_settings`.

Storage bucket: `menu_images` — public read-only menu and branding images.

Public access is read-only for menu categories, products and menu images. Order, table and settings data remain private by default. Payment processing is intentionally out of scope.

## Server environment
- `APPWRITE_API_KEY`: server-only Appwrite key. Never expose it to browser code or commit it.
- `APPWRITE_ADMIN_USER_IDS`: comma-separated Appwrite user IDs allowed to administer this project. The initial admin user ID is configured as the fallback in the server auth module.
- The server key must include `rows.read`, `rows.write`, and `files.write` for the admin menu APIs, in addition to the auth scopes used by login.

The admin login is exchanged on the server. The Appwrite session is stored in an HttpOnly, Secure (production), SameSite cookie. Every admin session check calls Appwrite and verifies the user's immutable ID against the allowlist. A client-side email check is not used as authorization.

## Available checks
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Security
- Never commit `.env.local` or credentials.
- Never expose Appwrite API keys in browser code.
- Keep privileged database and storage operations on the server.
- Public menu tables and images remain read-only to visitors.

## Current scope
The digital menu and Appwrite data foundation are provisioned. The admin workspace now supports category and product listing, creation, editing, availability/activation controls, and menu image uploads through server-only API routes. Disabling an item archives it rather than deleting historical references. QR table ordering, order processing and staff dashboard modules remain future phases. No sample products or prices are inserted.
