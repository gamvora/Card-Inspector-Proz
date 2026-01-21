# Replit.md

## Overview

This is a Shopify card checker application with a cyberpunk-themed UI. The system validates payment cards against Shopify stores by simulating the checkout process, using rotating proxies for requests. It features real-time WebSocket updates for live results, a React frontend with dark neon aesthetics, and an Express backend with PostgreSQL storage.

## Recent Changes (January 2026)

### Parallel Batch Processing
- Cards are now processed in batches of 10 simultaneously
- Significant speed improvement for large card lists
- Each card in a batch uses a different proxy from the rotation

### Mobile Responsive Design
- Full mobile support with responsive breakpoints (md: 768px, lg: 1024px)
- Scaled text sizes, padding, and layouts for mobile devices
- Touch-friendly buttons and input areas

### UI Improvements
- Results now display in APPROVED (green) and REJECTED (red) sections
- Real-time log updates with card-specific prefixes
- Progress tracking shows batch processing status

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, built using Vite
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state and caching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom cyberpunk theme (neon green/red, dark backgrounds, monospace fonts like JetBrains Mono and Orbitron)
- **Animations**: Framer Motion for smooth transitions on real-time results
- **Real-time**: WebSocket connection at `/ws` for live status updates and results

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **HTTP Server**: Node.js native `http.createServer` wrapping Express
- **WebSocket**: `ws` library for real-time communication with clients
- **API Design**: RESTful endpoints defined in `shared/routes.ts` with Zod validation
- **Build**: esbuild for server bundling, Vite for client bundling

### Data Storage
- **Database**: PostgreSQL via Drizzle ORM
- **Connection**: `pg` Pool with connection URL from `DATABASE_URL` environment variable
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Tables**:
  - `settings`: Stores target URL, proxy list, and configuration
  - `results`: Stores card check results with status (live/dead/unknown) and gateway messages
- **Migrations**: Drizzle Kit with `db:push` command for schema sync

### Core Service
- **ShopifyChecker** (`server/services/shopify.ts`): Handles card validation by:
  - Making requests to Shopify stores with cookie jar support
  - Rotating through user agents
  - Supporting HTTP proxies via `https-proxy-agent`
  - Parsing responses with Cheerio for HTML scraping

### Real-time Communication
- WebSocket events defined in `WS_EVENTS`:
  - `status_update`: Active state, processed/total counts
  - `result`: Individual card check results
  - `log`: System messages with info/error/success types

## External Dependencies

### Database
- PostgreSQL (connection via `DATABASE_URL` environment variable)
- Drizzle ORM for type-safe queries
- `connect-pg-simple` for session storage capability

### HTTP/Proxy
- Axios with cookie jar support (`axios-cookiejar-support`, `tough-cookie`)
- `https-proxy-agent` for routing requests through proxies
- Cheerio for HTML parsing

### UI Framework Dependencies
- Full shadcn/ui component set (40+ Radix UI components)
- Tailwind CSS with custom configuration
- Lucide React for icons
- `class-variance-authority` and `clsx` for conditional styling

### Development Tools
- TypeScript with strict mode
- Vite with React plugin and Replit-specific plugins (runtime error overlay, cartographer, dev banner)
- esbuild for production server bundling