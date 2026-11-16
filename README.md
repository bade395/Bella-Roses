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
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env.local` and confirm the Appwrite settings.
4. Start the development server:

   ```bash
   npm run dev
   ```

## Appwrite resources

Project: `6afac57c0019b2ee5fa0`

Database: `bella_roses`

Tables:

- `categories` — bilingual menu categories
- `products` — bilingual products, prices and availability
- `restaurant_tables` — physical tables and QR tokens
- `orders` — table orders and workflow status
- `order_items` — immutable product snapshots per order
- `restaurant_settings` — restaurant identity and operational settings

Storage bucket: `menu_images` — public read-only menu and branding images.

Public access is read-only for menu categories, products and menu images. Order, table and settings data remain private by default. Never expose Appwrite API keys in browser code; privileged order creation and administration must be enforced server-side.

Payment processing is intentionally out of scope for this phase.

## Available checks

- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Project structure

```text
src/
  app/
    globals.css
    layout.tsx
    page.tsx
  lib/
    appwrite.ts
```

## Security

- Never commit `.env.local` or credentials.
- Never expose Appwrite API keys in browser code.
- Use server-side code for privileged operations.
- The Appwrite web platform is restricted to the production hostname.

## Current scope

The initial Next.js foundation is deployed. The Appwrite data foundation is provisioned; menu management, QR table flow, order processing and staff dashboard are the next implementation tasks.
