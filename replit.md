# Replit.md

## Overview

This is a Telegram Web App for Shopify card checking with multi-user support, credit system, and admin panel. The system validates payment cards against Shopify stores by simulating the checkout process, using rotating proxies for requests. It features real-time WebSocket updates, Telegram authentication, credit-based checking, and a mobile-optimized React frontend.

## Recent Changes (January 2026)

### Telegram Web App Integration
- Full Telegram WebApp authentication via initData validation
- User accounts linked to Telegram IDs
- Admin panel accessible via Telegram bot commands
- Admin ID: 5197976453

### Multi-User Credit System
- 1 credit = 1 card check (deducted immediately per card)
- Credits stored persistently in PostgreSQL database
- Admin can add credits via `/credit [user_id] [amount]` bot command
- Credit transactions logged for accountability
- Real-time WebSocket updates for credit changes
- Auto-refresh credits on page visibility change
- Periodic sync every 30 seconds for reliability
- Credits update immediately on website when admin adds via Telegram

### Multi-Site Management
- Users can add multiple Shopify sites with custom names
- Set active site for checking
- Each user has isolated site configurations

### Proxy Management
- Individual proxy lists per user
- Proxy format validation (host:port:user:pass)
- Type detection from hostname keywords (Rotating/Datacenter/Residential/Static)
- Clear all proxies functionality

### Enhanced Statistics
- Total charged/rejected cards tracked per user
- Session-specific live/dead counts
- Real-time statistics display

### UI Improvements (January 2026)
- Clean mobile-first design with bottom navigation (Home, Profile, Settings)
- Header with credits balance, total approved/declined stats
- Card input textarea with card count display and file upload support (.txt files)
- Neon border animation on card input when focused
- Site selector with left/right navigation arrows
- APPROVED/DECLINED tabs for filtering results
- Result cards with status indicator and copy button
- Dedicated Profile page with:
  - Online Users section with live status indicators
  - Top Karders leaderboard with rankings
  - Statistics cards (Total Cards, Hit Rate, Live Cards, Global Avg)
  - Three chart types with tab navigation (Bar, Donut, Area)
- Beautiful Loading page with user avatar, welcome message, and "Loading Magic" text
- Toast notifications with sound effects (success/error/default), 6-second auto-dismiss
- Modern Settings page with card-based layouts and Framer Motion animations
- Support section with bot owner @lucee7 contact link
- Multi-theme system: Light, Dark, System, Nighty (purple), Forest (green), Sunset (warm)
- Theme selector dropdown in Settings header
- Bot owner @lucee7 visible in header with Telegram link
- Renamed "rejected" to "declined" throughout user-facing text

## User Preferences

Preferred communication style: Simple, everyday language (Arabic).

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, built using Vite
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state and caching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom cyberpunk theme
- **Animations**: Framer Motion for smooth transitions
- **Real-time**: WebSocket connection at `/ws` for live updates
- **Auth**: Telegram WebApp SDK integration via `client/src/lib/auth.tsx`

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **WebSocket**: `ws` library for real-time communication (per-user scoped)
- **Telegram Bot**: `/api/telegram/webhook` for bot commands
- **Auth Middleware**: JWT tokens (Authorization: Bearer) for production, x-telegram-id fallback in development only

### Security Features
- **JWT Authentication**: Secure tokens stored in localStorage, used in Authorization header
- **Per-user WebSocket Scoping**: Users only receive their own messages/updates
- **Ownership Checks**: All site/proxy mutations verify user ownership before execution
- **Per-user Job Management**: Each user has isolated checker state (Map<userId, jobState>)
- **Admin-only Routes**: Global settings require isAdmin verification
- **Production Security**: x-telegram-id header fallback is blocked when NODE_ENV !== 'development'

### Database Schema
- **users**: Telegram user data, credits, statistics
- **sites**: User's Shopify sites with custom names
- **proxies**: User's proxy list
- **results**: Card check results with user tracking
- **check_sessions**: Session tracking for progress
- **credit_transactions**: Credit history log
- **settings**: Global fallback configuration

### API Endpoints
- `POST /api/auth/login` - Telegram authentication
- `GET/POST /api/sites` - Site management
- `GET/POST/DELETE /api/proxies` - Proxy management
- `GET/POST /api/credits/*` - Credit management
- `POST /api/check/start` - Start card checking
- `POST /api/check/stop` - Stop checking
- `GET /api/stats` - User statistics
- `POST /api/telegram/webhook` - Bot webhook

### Core Checker Service
- **Location**: `server/python/checker.py`
- **6-Step Process**:
  1. Find cheapest available product
  2. Get checkout session tokens
  3. Tokenize card via Shopify
  4. Get shipping proposal
  5. Submit payment
  6. Poll for receipt result

### Real-time WebSocket Events
- `status_update`: Active state, processed/total, charged/rejected counts
- `result`: Individual card check results
- `log`: System messages with info/error/success types
- `credits_update`: Real-time credit balance updates

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `TELEGRAM_BOT_TOKEN`: Telegram bot token for authentication
- `TELEGRAM_ADMIN_ID`: Admin user's Telegram ID (5197976453)
- `SESSION_SECRET`: Session encryption secret

## Key Files

- `shared/schema.ts`: Database schema definitions
- `server/routes.ts`: All API endpoints
- `server/services/telegram.ts`: Telegram authentication service
- `server/services/telegramBot.ts`: Bot command handling
- `server/python/checker.py`: Card validation logic
- `client/src/lib/auth.tsx`: Frontend auth context
- `client/src/pages/Home.tsx`: Main checker interface
- `client/src/pages/Settings.tsx`: Site/proxy management
- `client/src/pages/Profile.tsx`: User profile with analytics
- `client/src/pages/Loading.tsx`: Loading screen
- `client/src/hooks/use-toast.ts`: Enhanced toast system with sound
