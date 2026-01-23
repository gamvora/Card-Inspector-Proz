import { pgTable, text, serial, timestamp, boolean, integer, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===

// Telegram Users
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  telegramId: varchar("telegram_id", { length: 50 }).notNull().unique(),
  username: varchar("username", { length: 100 }),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  photoUrl: text("photo_url"),
  credits: integer("credits").default(0).notNull(),
  totalCharged: integer("total_charged").default(0).notNull(),
  totalRejected: integer("total_rejected").default(0).notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  hasSeenTutorial: boolean("has_seen_tutorial").default(false).notNull(),
  referralCode: varchar("referral_code", { length: 20 }).unique(),
  referredBy: integer("referred_by"),
  createdAt: timestamp("created_at").defaultNow(),
  lastActiveAt: timestamp("last_active_at").defaultNow(),
});

// User Sites - Multiple sites per user with custom names
export const sites = pgTable("sites", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  url: text("url").notNull(),
  productPrice: varchar("product_price", { length: 50 }),
  isActive: boolean("is_active").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// User Proxies
export const proxies = pgTable("proxies", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  proxy: text("proxy").notNull(),
  isValid: boolean("is_valid").default(true).notNull(),
  lastChecked: timestamp("last_checked"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Store configuration (global settings - fallback)
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  targetUrl: text("target_url").default(""),
  proxyList: text("proxy_list").default(""),
  proxyEnabled: boolean("proxy_enabled").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Store check results with user tracking
export const results = pgTable("results", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  sessionId: varchar("session_id", { length: 50 }),
  card: text("card").notNull(),
  status: text("status").notNull(),
  message: text("message"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Check sessions - for tracking progress
export const checkSessions = pgTable("check_sessions", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id", { length: 50 }).notNull().unique(),
  userId: integer("user_id").notNull(),
  siteId: integer("site_id"),
  totalCards: integer("total_cards").default(0).notNull(),
  processedCards: integer("processed_cards").default(0).notNull(),
  chargedCards: integer("charged_cards").default(0).notNull(),
  rejectedCards: integer("rejected_cards").default(0).notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Credit transactions log
export const creditTransactions = pgTable("credit_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  amount: integer("amount").notNull(),
  type: varchar("type", { length: 20 }).notNull(),
  description: text("description"),
  adminId: varchar("admin_id", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Referral system
export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrer_id").notNull(),
  referredId: integer("referred_id").notNull(),
  referralCode: varchar("referral_code", { length: 20 }).notNull(),
  creditsAwarded: integer("credits_awarded").default(100).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Daily spin wheel
export const dailySpins = pgTable("daily_spins", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  creditsWon: integer("credits_won").notNull(),
  spinDate: timestamp("spin_date").defaultNow(),
});

// Daily streak tracking
export const dailyStreaks = pgTable("daily_streaks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  currentStreak: integer("current_streak").default(0).notNull(),
  longestStreak: integer("longest_streak").default(0).notNull(),
  lastClaimDate: timestamp("last_claim_date"),
  totalClaimed: integer("total_claimed").default(0).notNull(),
});

// User notification settings
export const notificationSettings = pgTable("notification_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  approvedAlerts: boolean("approved_alerts").default(true).notNull(),
  dailySummary: boolean("daily_summary").default(false).notNull(),
  streakReminder: boolean("streak_reminder").default(true).notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// === SCHEMAS ===
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, lastActiveAt: true });
export const insertSiteSchema = createInsertSchema(sites).omit({ id: true, createdAt: true });
export const insertProxySchema = createInsertSchema(proxies).omit({ id: true, createdAt: true, lastChecked: true });
export const insertSettingsSchema = createInsertSchema(settings).omit({ id: true, updatedAt: true });
export const insertResultSchema = createInsertSchema(results).omit({ id: true, createdAt: true });
export const insertCheckSessionSchema = createInsertSchema(checkSessions).omit({ id: true, createdAt: true, completedAt: true });
export const insertCreditTransactionSchema = createInsertSchema(creditTransactions).omit({ id: true, createdAt: true });
export const insertReferralSchema = createInsertSchema(referrals).omit({ id: true, createdAt: true });
export const insertDailySpinSchema = createInsertSchema(dailySpins).omit({ id: true, spinDate: true });
export const insertDailyStreakSchema = createInsertSchema(dailyStreaks).omit({ id: true });
export const insertNotificationSettingsSchema = createInsertSchema(notificationSettings).omit({ id: true, updatedAt: true });

// === TYPES ===
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Site = typeof sites.$inferSelect;
export type InsertSite = z.infer<typeof insertSiteSchema>;
export type Proxy = typeof proxies.$inferSelect;
export type InsertProxy = z.infer<typeof insertProxySchema>;
export type Settings = typeof settings.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type CheckResult = typeof results.$inferSelect;
export type InsertResult = z.infer<typeof insertResultSchema>;
export type CheckSession = typeof checkSessions.$inferSelect;
export type InsertCheckSession = z.infer<typeof insertCheckSessionSchema>;
export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type DailySpin = typeof dailySpins.$inferSelect;
export type InsertDailySpin = z.infer<typeof insertDailySpinSchema>;
export type DailyStreak = typeof dailyStreaks.$inferSelect;
export type InsertDailyStreak = z.infer<typeof insertDailyStreakSchema>;
export type NotificationSettings = typeof notificationSettings.$inferSelect;
export type InsertNotificationSettings = z.infer<typeof insertNotificationSettingsSchema>;

// Admin ID constant
export const ADMIN_TELEGRAM_ID = "5197976453";

// WebSocket Message Types
export const WS_EVENTS = {
  STATUS_UPDATE: 'status_update',
  RESULT: 'result',
  LOG: 'log',
  CREDITS_UPDATE: 'credits_update',
  SESSION_UPDATE: 'session_update',
} as const;

export interface CheckJobRequest {
  cards: string[];
  siteId?: number;
  userId?: number;
  sessionId?: string;
}

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}
