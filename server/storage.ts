import { db } from "./db";
import {
  settings,
  results,
  type Settings,
  type InsertSettings,
  type CheckResult,
  insertSettingsSchema,
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Settings
  getSettings(): Promise<Settings | undefined>;
  updateSettings(newSettings: InsertSettings): Promise<Settings>;

  // Results
  addResult(result: { card: string; status: string; message?: string }): Promise<CheckResult>;
  getResults(limit?: number): Promise<CheckResult[]>;
  clearResults(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getSettings(): Promise<Settings | undefined> {
    const [config] = await db.select().from(settings).limit(1);
    return config;
  }

  async updateSettings(newSettings: InsertSettings): Promise<Settings> {
    const existing = await this.getSettings();
    if (existing) {
      const [updated] = await db
        .update(settings)
        .set({ ...newSettings, updatedAt: new Date() })
        .where(eq(settings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(settings).values(newSettings).returning();
      return created;
    }
  }

  async addResult(result: { card: string; status: string; message?: string }): Promise<CheckResult> {
    const [saved] = await db.insert(results).values({
      card: result.card,
      status: result.status,
      message: result.message || "",
    }).returning();
    return saved;
  }

  async getResults(limit = 100): Promise<CheckResult[]> {
    return db.select().from(results).orderBy(desc(results.createdAt)).limit(limit);
  }

  async clearResults(): Promise<void> {
    await db.delete(results);
  }
}

export const storage = new DatabaseStorage();
