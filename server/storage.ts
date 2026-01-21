import { db } from "./db";
import {
  settings,
  results,
  users,
  sites,
  proxies,
  checkSessions,
  creditTransactions,
  type Settings,
  type InsertSettings,
  type CheckResult,
  type User,
  type InsertUser,
  type Site,
  type InsertSite,
  type Proxy,
  type InsertProxy,
  type CheckSession,
  type InsertCheckSession,
  type CreditTransaction,
  ADMIN_TELEGRAM_ID,
} from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  getUserByTelegramId(telegramId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getOrCreateUser(user: InsertUser): Promise<User>;
  updateUser(telegramId: string, data: Partial<InsertUser>): Promise<User | undefined>;
  updateUserCredits(telegramId: string, amount: number): Promise<User | undefined>;
  updateUserStats(telegramId: string, charged: number, rejected: number): Promise<void>;

  // Sites
  getUserSites(userId: number): Promise<Site[]>;
  getActiveSite(userId: number): Promise<Site | undefined>;
  getSiteById(id: number): Promise<Site | undefined>;
  addSite(site: InsertSite): Promise<Site>;
  updateSite(id: number, data: Partial<InsertSite>): Promise<Site | undefined>;
  deleteSite(id: number): Promise<void>;
  setActiveSite(userId: number, siteId: number): Promise<void>;

  // Proxies
  getUserProxies(userId: number): Promise<Proxy[]>;
  addProxy(proxy: InsertProxy): Promise<Proxy>;
  updateProxy(id: number, data: Partial<InsertProxy>): Promise<void>;
  deleteProxy(id: number): Promise<void>;
  deleteAllUserProxies(userId: number): Promise<void>;

  // Settings (global fallback)
  getSettings(): Promise<Settings | undefined>;
  updateSettings(newSettings: InsertSettings): Promise<Settings>;

  // Results
  addResult(result: { card: string; status: string; message?: string; userId?: number; sessionId?: string }): Promise<CheckResult>;
  getResults(limit?: number, userId?: number): Promise<CheckResult[]>;
  clearResults(userId?: number): Promise<void>;

  // Check Sessions
  createCheckSession(session: InsertCheckSession): Promise<CheckSession>;
  updateCheckSession(sessionId: string, data: Partial<InsertCheckSession>): Promise<void>;
  getCheckSession(sessionId: string): Promise<CheckSession | undefined>;

  // Credit Transactions
  addCreditTransaction(userId: number, amount: number, type: string, description?: string, adminId?: string): Promise<CreditTransaction>;
  getCreditTransactions(userId: number, limit?: number): Promise<CreditTransaction[]>;

  // Global Stats & Leaderboard
  getGlobalStats(): Promise<{ totalCards: number; totalLive: number; totalDead: number; hitRate: number }>;
  getLeaderboard(limit?: number): Promise<Array<{ userId: number; username: string | null; firstName: string | null; lastName: string | null; totalCharged: number; rank: number }>>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUserByTelegramId(telegramId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.telegramId, telegramId)).limit(1);
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const isAdmin = user.telegramId === ADMIN_TELEGRAM_ID;
    const [created] = await db.insert(users).values({
      ...user,
      isAdmin,
      credits: isAdmin ? 999999 : (user.credits || 0),
    }).returning();
    return created;
  }

  async getOrCreateUser(user: InsertUser): Promise<User> {
    const existing = await this.getUserByTelegramId(user.telegramId);
    if (existing) {
      return existing;
    }
    
    try {
      const isAdmin = user.telegramId === ADMIN_TELEGRAM_ID;
      const [created] = await db.insert(users).values({
        ...user,
        isAdmin,
        credits: isAdmin ? 999999 : (user.credits || 0),
      }).onConflictDoNothing({ target: users.telegramId }).returning();
      
      if (created) {
        return created;
      }
      
      const retryFetch = await this.getUserByTelegramId(user.telegramId);
      if (retryFetch) {
        return retryFetch;
      }
      
      throw new Error('Failed to create or find user');
    } catch (error) {
      const retryFetch = await this.getUserByTelegramId(user.telegramId);
      if (retryFetch) {
        return retryFetch;
      }
      throw error;
    }
  }

  async updateUser(telegramId: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({ ...data, lastActiveAt: new Date() })
      .where(eq(users.telegramId, telegramId))
      .returning();
    return updated;
  }

  async updateUserCredits(telegramId: string, amount: number): Promise<User | undefined> {
    const user = await this.getUserByTelegramId(telegramId);
    if (!user) return undefined;
    
    const newCredits = Math.max(0, user.credits + amount);
    const [updated] = await db
      .update(users)
      .set({ credits: newCredits, lastActiveAt: new Date() })
      .where(eq(users.telegramId, telegramId))
      .returning();
    return updated;
  }

  async updateUserStats(telegramId: string, charged: number, rejected: number): Promise<void> {
    const user = await this.getUserByTelegramId(telegramId);
    if (!user) return;
    
    await db
      .update(users)
      .set({
        totalCharged: user.totalCharged + charged,
        totalRejected: user.totalRejected + rejected,
        lastActiveAt: new Date(),
      })
      .where(eq(users.telegramId, telegramId));
  }

  // Sites
  async getUserSites(userId: number): Promise<Site[]> {
    return db.select().from(sites).where(eq(sites.userId, userId)).orderBy(desc(sites.createdAt));
  }

  async getActiveSite(userId: number): Promise<Site | undefined> {
    const [site] = await db.select().from(sites).where(and(eq(sites.userId, userId), eq(sites.isActive, true))).limit(1);
    return site;
  }

  async getSiteById(id: number): Promise<Site | undefined> {
    const [site] = await db.select().from(sites).where(eq(sites.id, id)).limit(1);
    return site;
  }

  async addSite(site: InsertSite): Promise<Site> {
    const [created] = await db.insert(sites).values(site).returning();
    return created;
  }

  async updateSite(id: number, data: Partial<InsertSite>): Promise<Site | undefined> {
    const [updated] = await db.update(sites).set(data).where(eq(sites.id, id)).returning();
    return updated;
  }

  async deleteSite(id: number): Promise<void> {
    await db.delete(sites).where(eq(sites.id, id));
  }

  async setActiveSite(userId: number, siteId: number): Promise<void> {
    await db.update(sites).set({ isActive: false }).where(eq(sites.userId, userId));
    await db.update(sites).set({ isActive: true }).where(eq(sites.id, siteId));
  }

  // Proxies
  async getUserProxies(userId: number): Promise<Proxy[]> {
    return db.select().from(proxies).where(eq(proxies.userId, userId)).orderBy(desc(proxies.createdAt));
  }

  async addProxy(proxy: InsertProxy): Promise<Proxy> {
    const [created] = await db.insert(proxies).values(proxy).returning();
    return created;
  }

  async updateProxy(id: number, data: Partial<InsertProxy>): Promise<void> {
    await db.update(proxies).set(data).where(eq(proxies.id, id));
  }

  async deleteProxy(id: number): Promise<void> {
    await db.delete(proxies).where(eq(proxies.id, id));
  }

  async deleteAllUserProxies(userId: number): Promise<void> {
    await db.delete(proxies).where(eq(proxies.userId, userId));
  }

  // Settings (global fallback)
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

  // Results
  async addResult(result: { card: string; status: string; message?: string; userId?: number; sessionId?: string }): Promise<CheckResult> {
    const [saved] = await db.insert(results).values({
      card: result.card,
      status: result.status,
      message: result.message || "",
      userId: result.userId,
      sessionId: result.sessionId,
    }).returning();
    return saved;
  }

  async getResults(limit = 100, userId?: number): Promise<CheckResult[]> {
    if (userId) {
      return db.select().from(results).where(eq(results.userId, userId)).orderBy(desc(results.createdAt)).limit(limit);
    }
    return db.select().from(results).orderBy(desc(results.createdAt)).limit(limit);
  }

  async clearResults(userId?: number): Promise<void> {
    if (userId) {
      await db.delete(results).where(eq(results.userId, userId));
    } else {
      await db.delete(results);
    }
  }

  // Check Sessions
  async createCheckSession(session: InsertCheckSession): Promise<CheckSession> {
    const [created] = await db.insert(checkSessions).values(session).returning();
    return created;
  }

  async updateCheckSession(sessionId: string, data: Partial<InsertCheckSession>): Promise<void> {
    await db.update(checkSessions).set(data).where(eq(checkSessions.sessionId, sessionId));
  }

  async getCheckSession(sessionId: string): Promise<CheckSession | undefined> {
    const [session] = await db.select().from(checkSessions).where(eq(checkSessions.sessionId, sessionId)).limit(1);
    return session;
  }

  // Credit Transactions
  async addCreditTransaction(userId: number, amount: number, type: string, description?: string, adminId?: string): Promise<CreditTransaction> {
    const [created] = await db.insert(creditTransactions).values({
      userId,
      amount,
      type,
      description,
      adminId,
    }).returning();
    return created;
  }

  async getCreditTransactions(userId: number, limit = 50): Promise<CreditTransaction[]> {
    return db.select().from(creditTransactions).where(eq(creditTransactions.userId, userId)).orderBy(desc(creditTransactions.createdAt)).limit(limit);
  }

  async getGlobalStats(): Promise<{ totalCards: number; totalLive: number; totalDead: number; hitRate: number }> {
    const result = await db.select({
      totalLive: sql<number>`COALESCE(SUM(${users.totalCharged}), 0)::int`,
      totalDead: sql<number>`COALESCE(SUM(${users.totalRejected}), 0)::int`,
    }).from(users);
    
    const totalLive = result[0]?.totalLive || 0;
    const totalDead = result[0]?.totalDead || 0;
    const totalCards = totalLive + totalDead;
    const hitRate = totalCards > 0 ? (totalLive / totalCards) * 100 : 0;
    
    return { totalCards, totalLive, totalDead, hitRate };
  }

  async getLeaderboard(limit = 10): Promise<Array<{ userId: number; username: string | null; firstName: string | null; lastName: string | null; totalCharged: number; rank: number }>> {
    const topUsers = await db.select({
      userId: users.id,
      username: users.username,
      firstName: users.firstName,
      lastName: users.lastName,
      totalCharged: users.totalCharged,
    }).from(users).orderBy(desc(users.totalCharged)).limit(limit);
    
    return topUsers.map((user, index) => ({
      ...user,
      rank: index + 1,
    }));
  }
}

export const storage = new DatabaseStorage();
