# Bella Roses

Luxury digital menu and smart restaurant management system.

## Technology

- Next.js App Router
- TypeScript (strict mode)
- Tailwind CSS
- Appwrite Cloud (backend services)
- Vercel (planned hosting)

## Requirements

- Node.js 20.9+
- npm

## Getting started

1. Clone the repository.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env.local` and confirm the Appwrite endpoint and project ID.
4. Start the development server:

   ```bash
   npm run dev
   ```

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
- Configure Appwrite platform hostnames for deployed domains before production.

## Current scope

This repository contains the initial application foundation only. Restaurant data models,
menu management, table ordering, staff dashboard, and production integrations are planned
for subsequent implementation phases.
