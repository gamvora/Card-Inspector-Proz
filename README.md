# Card Inspector Pro

A Telegram Web App for Shopify card checking with multi-user support, credit system, and admin panel.

## Changes Made

### Removed Database Dependency
- Removed PostgreSQL database requirement
- Replaced with JSON file-based storage system
- All data is now stored in the `data/` directory

### New Storage System
- `server/storage.ts`: New file-based storage implementation
- Data files are stored as JSON in the `data/` directory
- No external database setup required

### Files Modified
- `shared/schema.ts`: Removed Drizzle ORM definitions, kept TypeScript types
- `server/storage.ts`: Complete rewrite using JSON file storage
- `package.json`: Removed database-related dependencies
- `script/build.ts`: Updated build configuration
- `.replit`: Removed PostgreSQL module

### Files Removed
- `server/db.ts`: Database connection file
- `drizzle.config.ts`: Drizzle ORM configuration

### Data Storage
All user data, sites, proxies, results, and other information is now stored in JSON files:
- `data/users.json` - User accounts
- `data/sites.json` - Shopify sites
- `data/proxies.json` - Proxy configurations
- `data/results.json` - Card check results
- `data/settings.json` - Global settings
- `data/creditTransactions.json` - Credit transaction history
- `data/checkSessions.json` - Check session tracking
- `data/dailySpins.json` - Daily spin wheel records
- `data/dailyStreaks.json` - Daily streak tracking
- `data/notificationSettings.json` - User notification preferences
- `data/referrals.json` - Referral system data

## Environment Variables

- `TELEGRAM_BOT_TOKEN`: Telegram bot token for authentication
- `TELEGRAM_ADMIN_ID`: Admin user's Telegram ID
- `SESSION_SECRET`: Session encryption secret

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set environment variables

3. Start the development server:
   ```bash
   npm run dev
   ```

## Build for Production

```bash
npm run build
npm start
```

The application will run on port 5000 by default.
