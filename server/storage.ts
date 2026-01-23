import { db } from "./db";
import {
  settings,
  results,
  users,
  sites,
  proxies,
  checkSessions,
  creditTransactions,
  referrals,
  dailySpins,
  dailyStreaks,
  notificationSettings,
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
  type Referral,
  type DailySpin,
  type DailyStreak,
  type NotificationSettings,
  ADMIN_TELEGRAM_ID,
} from "@shared/schema";
import { eq, desc, and, sql, gte } from "drizzle-orm";

export interface IStorage {
  // Users
  getUserByTelegramId(telegramId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getOrCreateUser(user: InsertUser): Promise<User>;
  updateUser(telegramId: string, data: Partial<InsertUser>): Promise<User | undefined>;
  updateUserCredits(telegramId: string, amount: number): Promise<User | undefined>;
  updateUserStats(telegramId: string, charged: number, rejected: number): Promise<void>;
  markTutorialSeen(telegramId: string): Promise<User | undefined>;

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
  getLeaderboard(limit?: number): Promise<Array<{ userId: number; username: string | null; firstName: string | null; lastName: string | null; photoUrl: string | null; totalCharged: number; rank: number }>>;

  // Referrals
  getUserByReferralCode(code: string): Promise<User | undefined>;
  createReferral(referrerId: number, referredId: number, code: string): Promise<Referral>;
  getReferralsByUser(userId: number): Promise<Referral[]>;
  getReferralCount(userId: number): Promise<number>;
  generateReferralCode(userId: number): Promise<string>;

  // Daily Spin
  getLastSpin(userId: number): Promise<DailySpin | undefined>;
  canSpinToday(userId: number): Promise<boolean>;
  recordSpin(userId: number, creditsWon: number): Promise<DailySpin>;

  // Daily Streak
  getStreak(userId: number): Promise<DailyStreak | undefined>;
  claimStreak(userId: number): Promise<{ streak: DailyStreak; reward: number; canClaim: boolean }>;

  // Notification Settings
  getNotificationSettings(userId: number): Promise<NotificationSettings | undefined>;
  updateNotificationSettings(userId: number, settings: Partial<NotificationSettings>): Promise<NotificationSettings>;
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

  async markTutorialSeen(telegramId: string): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({ hasSeenTutorial: true, lastActiveAt: new Date() })
      .where(eq(users.telegramId, telegramId))
      .returning();
    return updated;
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

  async getLeaderboard(limit = 10): Promise<Array<{ userId: number; username: string | null; firstName: string | null; lastName: string | null; photoUrl: string | null; totalCharged: number; rank: number }>> {
    const topUsers = await db.select({
      userId: users.id,
      username: users.username,
      firstName: users.firstName,
      lastName: users.lastName,
      photoUrl: users.photoUrl,
      totalCharged: users.totalCharged,
    }).from(users).orderBy(desc(users.totalCharged)).limit(limit);
    
    return topUsers.map((user, index) => ({
      ...user,
      rank: index + 1,
    }));
  }

  // Referrals
  async getUserByReferralCode(code: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.referralCode, code)).limit(1);
    return user;
  }

  async createReferral(referrerId: number, referredId: number, code: string): Promise<Referral> {
    const [referral] = await db.insert(referrals).values({
      referrerId,
      referredId,
      referralCode: code,
      creditsAwarded: 100,
    }).returning();
    return referral;
  }

  async getReferralsByUser(userId: number): Promise<Referral[]> {
    return db.select().from(referrals).where(eq(referrals.referrerId, userId)).orderBy(desc(referrals.createdAt));
  }

  async getReferralCount(userId: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(referrals).where(eq(referrals.referrerId, userId));
    return result[0]?.count || 0;
  }

  async generateReferralCode(userId: number): Promise<string> {
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (user[0]?.referralCode) {
      return user[0].referralCode;
    }
    const code = 'NX' + Math.random().toString(36).substring(2, 8).toUpperCase();
    await db.update(users).set({ referralCode: code }).where(eq(users.id, userId));
    return code;
  }

  // Daily Spin
  async getLastSpin(userId: number): Promise<DailySpin | undefined> {
    const [spin] = await db.select().from(dailySpins).where(eq(dailySpins.userId, userId)).orderBy(desc(dailySpins.spinDate)).limit(1);
    return spin;
  }

  async canSpinToday(userId: number): Promise<boolean> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [spin] = await db.select().from(dailySpins)
      .where(and(eq(dailySpins.userId, userId), gte(dailySpins.spinDate, today)))
      .limit(1);
    return !spin;
  }

  async recordSpin(userId: number, creditsWon: number): Promise<DailySpin> {
    const [spin] = await db.insert(dailySpins).values({
      userId,
      creditsWon,
    }).returning();
    return spin;
  }

  // Daily Streak
  async getStreak(userId: number): Promise<DailyStreak | undefined> {
    const [streak] = await db.select().from(dailyStreaks).where(eq(dailyStreaks.userId, userId)).limit(1);
    return streak;
  }

  async claimStreak(userId: number): Promise<{ streak: DailyStreak; reward: number; canClaim: boolean }> {
    let streak = await this.getStreak(userId);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const streakRewards: { [key: number]: number } = {
      1: 30, 2: 30, 3: 45, 4: 45, 5: 45, 6: 45, 7: 70,
      8: 70, 9: 70, 10: 70, 11: 70, 12: 70, 13: 70, 14: 110,
      15: 110, 16: 110, 17: 110, 18: 110, 19: 110, 20: 110,
      21: 110, 22: 110, 23: 110, 24: 110, 25: 110, 26: 110,
      27: 110, 28: 110, 29: 110, 30: 210,
    };

    if (!streak) {
      const [newStreak] = await db.insert(dailyStreaks).values({
        userId,
        currentStreak: 1,
        longestStreak: 1,
        lastClaimDate: now,
        totalClaimed: 1,
      }).returning();
      const reward = streakRewards[1] || 30;
      return { streak: newStreak, reward, canClaim: true };
    }

    const lastClaim = streak.lastClaimDate ? new Date(streak.lastClaimDate) : null;
    const lastClaimDate = lastClaim ? new Date(lastClaim.getFullYear(), lastClaim.getMonth(), lastClaim.getDate()) : null;
    
    if (lastClaimDate && lastClaimDate.getTime() === today.getTime()) {
      return { streak, reward: 0, canClaim: false };
    }

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let newStreak = 1;
    if (lastClaimDate && lastClaimDate.getTime() === yesterday.getTime()) {
      newStreak = Math.min(streak.currentStreak + 1, 30);
    }

    const reward = streakRewards[newStreak] || 30;
    const longestStreak = Math.max(streak.longestStreak, newStreak);

    const [updated] = await db.update(dailyStreaks).set({
      currentStreak: newStreak,
      longestStreak,
      lastClaimDate: now,
      totalClaimed: streak.totalClaimed + 1,
    }).where(eq(dailyStreaks.userId, userId)).returning();

    return { streak: updated, reward, canClaim: true };
  }

  // Notification Settings
  async getNotificationSettings(userId: number): Promise<NotificationSettings | undefined> {
    const [settings] = await db.select().from(notificationSettings).where(eq(notificationSettings.userId, userId)).limit(1);
    return settings;
  }

  async updateNotificationSettings(userId: number, newSettings: Partial<NotificationSettings>): Promise<NotificationSettings> {
    const existing = await this.getNotificationSettings(userId);
    if (existing) {
      const [updated] = await db.update(notificationSettings).set({
        ...newSettings,
        updatedAt: new Date(),
      }).where(eq(notificationSettings.userId, userId)).returning();
      return updated;
    }
    const [created] = await db.insert(notificationSettings).values({
      userId,
      approvedAlerts: newSettings.approvedAlerts ?? true,
      dailySummary: newSettings.dailySummary ?? false,
      streakReminder: newSettings.streakReminder ?? true,
    }).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
