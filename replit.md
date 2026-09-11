# Replit.md

## Overview

This is a Telegram Web App for Shopify card checking with multi-user support, credit system, and admin panel. The system validates payment cards against Shopify stores by simulating the checkout process, using rotating proxies for requests. It features real-time WebSocket updates, Telegram authentication, credit-based checking, and a mobile-optimized React frontend. **No database required** - all data is stored in JSON files.

## Recent Changes (January 2026)

### Auto-Save Product Price (Latest)
- **Automatic Price Capture**: When checking cards, the product price is automatically saved to the site
- **Display in Home**: Price shown next to site name in the site selector (green badge)
- **Display in Settings**: Price shown next to site name in the sites list
- **Persistent Storage**: Price saved to JSON files and displayed even after page refresh

### Security Captcha System
- **4-Digit Number Captcha**: Users must enter a 4-digit code shown in a colorful styled image
- **Anti-Bot Protection**: Prevents automated access to the app
- **Animated Display**: Numbers shown with random colors, rotations, and visual noise
- **Session Persistence**: Verification valid for 1 hour (stored in localStorage)
- **Refresh Button**: Users can request a new captcha if needed
- **Shows Before Tutorial**: Captcha appears first, then Loading screen, then Tutorial

### Rewards & Engagement System
- **Daily Spin Wheel**: Spin once per day for free credits (prizes: 20, 30, 40, 60, 85, 110 credits)
- **Daily Streak**: Claim daily rewards with increasing bonuses (Day1=30, Day3=45, Day7=70, Day14=110, Day30=210 credits)
- **Referral System**: Share unique code (NX + 6 chars) to earn 100 credits per new user; referred users get 50 credits bonus
- **Dedicated Rewards Page**: New page at `/rewards` with spin wheel, streak tracker, and referral management

### BIN Lookup Tool
- Search BIN (first 6 digits) to view card information
- Shows card scheme (Visa/MC), type (credit/debit), prepaid status
- Displays issuing bank name and country with flag emoji
- Located in Settings page

### Export Results Feature
- Export approved or declined results to .txt file
- Download button appears when results are available
- Format: card | status | message

### Notification Settings
- Toggle APPROVED card alerts via Telegram
- Toggle daily summary reports
- Toggle streak reminder notifications
- Settings persisted in JSON files

### Interactive Tutorial System
- **6-Step Tutorial**: Welcome, Cards, Site Selection, Start, Results, Settings
- **Auto-launch**: Tutorial shows automatically for first-time users (hasSeenTutorial flag)
- **Manual Restart**: HelpCircle button in header (purple icon) to restart tutorial anytime
- **Animated Demos**: Each step has CSS/Framer Motion animations demonstrating the feature
- **Keyboard Navigation**: Arrow keys (left/right), Enter (next), Escape (close)
- **Accessibility**: ARIA attributes, focus management, screen reader support
- **Persistence**: Tutorial completion saved to JSON files via `/api/tutorial/complete`

### Card Processing Improvements
- **Parallel Batch Processing**: Cards are processed in parallel batches (up to 10 cards at once) for maximum speed
- **Improved Stop Functionality**: Stop button now kills all processes immediately with SIGKILL fallback
- **Auto-refresh**: Status updates every 5 seconds, credits refresh every 30 seconds
- **Dev login removed**: Only Telegram authentication is supported (no dev_tester user)

### Telegram Web App Integration
- Full Telegram WebApp authentication via initData validation
- User accounts linked to Telegram IDs
- Admin panel accessible via Telegram bot commands
- Admin ID: 5197976453

### Multi-User Credit System
- 1 credit = 1 card check (deducted immediately per card)
- Credits stored in JSON files (no database required)
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
- **Real proxy testing before adding**: Tests actual connection, measures speed, checks IP
- **Automatic rotation detection**: Makes 2 requests to detect if proxy IP changes (rotating vs static)
- Type detection from hostname keywords (Rotating/Datacenter/Residential/Static)
- Clear all proxies functionality
- Proxy must pass connection test before being saved

### Enhanced Statistics
- Total charged/rejected cards tracked per user
- Session-specific live/dead counts
- Real-time statistics display

### UI Improvements (January 2026)
- Clean mobile-first design with bottom navigation (Home, Rewards, Profile, Settings)
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
- **users**: Telegram user data, credits, statistics (JSON file)
- **sites**: User's Shopify sites with custom names (JSON file)
- **proxies**: User's proxy list (JSON file)
- **results**: Card check results with user tracking (JSON file)
- **check_sessions**: Session tracking for progress (JSON file)
- **credit_transactions**: Credit history log (JSON file)
- **settings**: Global fallback configuration (JSON file)

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
- **Sequential 6-Step Process** (all must complete before returning result):
  1. Find cheapest available product from /products.json
  2. Get checkout session tokens (checkout_token, web_build_id, session_token, queue_token, stable_id, payment_method_identifier)
  3. Get card token/nonce from deposit.shopifycs.com/sessions
  4. Get proposal and shipping rates (handle, tax, total_amount, gateway)
  5. Submit payment for completion (SubmitForCompletion mutation)
  6. Poll for final receipt status (PollForReceipt query)
- **Retry Logic**: MAX_RETRIES=5 for each step
- **Result Types**: [CHARGED] SUCCESS, [CHARGED] INSUFFICIENT FUNDS, [CCN] INCORRECT CVC, [3DS] VERIFICATION REQUIRED, [DEAD] with error codes

### Real-time WebSocket Events
- `status_update`: Active state, processed/total, charged/rejected counts
- `result`: Individual card check results
- `log`: System messages with info/error/success types
- `credits_update`: Real-time credit balance updates

## Environment Variables

- `TELEGRAM_BOT_TOKEN`: Telegram bot token for authentication
- `TELEGRAM_ADMIN_ID`: Admin user's Telegram ID (5197976453)
- `SESSION_SECRET`: Session encryption secret

## Key Files

- `shared/schema.ts`: Type definitions and Zod schemas
- `server/storage.ts`: JSON file-based storage system
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
