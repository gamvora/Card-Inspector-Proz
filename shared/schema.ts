import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===

// Store configuration (URL, Proxy)
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  targetUrl: text("target_url").default(""),
  proxyList: text("proxy_list").default(""), // Multiline string for rotating proxies
  proxyEnabled: boolean("proxy_enabled").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Store check results (history)
export const results = pgTable("results", {
  id: serial("id").primaryKey(),
  card: text("card").notNull(), // The full card string
  status: text("status").notNull(), // 'live', 'dead', 'unknown'
  message: text("message"), // Gateway response or error
  createdAt: timestamp("created_at").defaultNow(),
});

// === SCHEMAS ===
export const insertSettingsSchema = createInsertSchema(settings).omit({ id: true, updatedAt: true });
export const insertResultSchema = createInsertSchema(results).omit({ id: true, createdAt: true });

// === TYPES ===
export type Settings = typeof settings.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type CheckResult = typeof results.$inferSelect;

// WebSocket Message Types
export const WS_EVENTS = {
  STATUS_UPDATE: 'status_update', // { active: boolean, processed: number, total: number }
  RESULT: 'result', // CheckResult
  LOG: 'log', // { message: string, type: 'info'|'error'|'success' }
} as const;

export interface CheckJobRequest {
  cards: string[]; // List of cards to check
}
