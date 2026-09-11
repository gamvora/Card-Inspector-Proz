import fs from "fs";
import path from "path";
import {
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
  type InsertNotificationSettings,
  ADMIN_TELEGRAM_ID,
} from "@shared/schema";

const DATA_DIR = path.join(process.cwd(), "data");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getFilePath(filename: string): string {
  return path.join(DATA_DIR, `${filename}.json`);
}

function readJSON<T>(filename: string): T[] {
  const filePath = getFilePath(filename);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const data = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(data);
}

function writeJSON<T>(filename: string, data: T[]): void {
  const filePath = getFilePath(filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function generateId(items: { id: number }[]): number {
  if (items.length === 0) return 1;
  return Math.max(...items.map((item) => item.id)) + 1;
}

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
  updateSitePrice(siteId: number, price: string): Promise<void>;

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

export class FileStorage implements IStorage {
  // Users
  async getUserByTelegramId(telegramId: string): Promise<User | undefined> {
    const users = readJSON<User>("users");
    return users.find((u) => u.telegramId === telegramId);
  }

  async createUser(user: InsertUser): Promise<User> {
    const users = readJSON<User>("users");
    const isAdmin = user.telegramId === ADMIN_TELEGRAM_ID;
    const newUser: User = {
      id: generateId(users),
      telegramId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      photoUrl: user.photoUrl,
      credits: isAdmin ? 999999 : (user.credits || 0),
      totalCharged: user.totalCharged || 0,
      totalRejected: user.totalRejected || 0,
      isAdmin,
      hasSeenTutorial: user.hasSeenTutorial || false,
      referralCode: user.referralCode,
      referredBy: user.referredBy,
      createdAt: new Date(),
      lastActiveAt: new Date(),
    };
    users.push(newUser);
    writeJSON("users", users);
    return newUser;
  }

  async getOrCreateUser(user: InsertUser): Promise<User> {
    const existing = await this.getUserByTelegramId(user.telegramId);
    if (existing) {
      return existing;
    }
    return this.createUser(user);
  }

  async updateUser(telegramId: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const users = readJSON<User>("users");
    const index = users.findIndex((u) => u.telegramId === telegramId);
    if (index === -1) return undefined;

    users[index] = {
      ...users[index],
      ...data,
      lastActiveAt: new Date(),
    };
    writeJSON("users", users);
    return users[index];
  }

  async updateUserCredits(telegramId: string, amount: number): Promise<User | undefined> {
    const user = await this.getUserByTelegramId(telegramId);
    if (!user) return undefined;

    const newCredits = Math.max(0, user.credits + amount);
    const users = readJSON<User>("users");
    const index = users.findIndex((u) => u.telegramId === telegramId);
    if (index === -1) return undefined;

    users[index] = {
      ...users[index],
      credits: newCredits,
      lastActiveAt: new Date(),
    };
    writeJSON("users", users);
    return users[index];
  }

  async updateUserStats(telegramId: string, charged: number, rejected: number): Promise<void> {
    const user = await this.getUserByTelegramId(telegramId);
    if (!user) return;

    const users = readJSON<User>("users");
    const index = users.findIndex((u) => u.telegramId === telegramId);
    if (index === -1) return;

    users[index] = {
      ...users[index],
      totalCharged: user.totalCharged + charged,
      totalRejected: user.totalRejected + rejected,
      lastActiveAt: new Date(),
    };
    writeJSON("users", users);
  }

  async markTutorialSeen(telegramId: string): Promise<User | undefined> {
    const users = readJSON<User>("users");
    const index = users.findIndex((u) => u.telegramId === telegramId);
    if (index === -1) return undefined;

    users[index] = {
      ...users[index],
      hasSeenTutorial: true,
      lastActiveAt: new Date(),
    };
    writeJSON("users", users);
    return users[index];
  }

  // Sites
  async getUserSites(userId: number): Promise<Site[]> {
    const sites = readJSON<Site>("sites");
    return sites
      .filter((s) => s.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getActiveSite(userId: number): Promise<Site | undefined> {
    const sites = readJSON<Site>("sites");
    return sites.find((s) => s.userId === userId && s.isActive);
  }

  async getSiteById(id: number): Promise<Site | undefined> {
    const sites = readJSON<Site>("sites");
    return sites.find((s) => s.id === id);
  }

  async addSite(site: InsertSite): Promise<Site> {
    const sites = readJSON<Site>("sites");
    const newSite: Site = {
      id: generateId(sites),
      userId: site.userId,
      name: site.name,
      url: site.url,
      productPrice: site.productPrice,
      isActive: site.isActive || false,
      createdAt: new Date(),
    };
    sites.push(newSite);
    writeJSON("sites", sites);
    return newSite;
  }

  async updateSite(id: number, data: Partial<InsertSite>): Promise<Site | undefined> {
    const sites = readJSON<Site>("sites");
    const index = sites.findIndex((s) => s.id === id);
    if (index === -1) return undefined;

    sites[index] = {
      ...sites[index],
      ...data,
    };
    writeJSON("sites", sites);
    return sites[index];
  }

  async deleteSite(id: number): Promise<void> {
    const sites = readJSON<Site>("sites");
    const filtered = sites.filter((s) => s.id !== id);
    writeJSON("sites", filtered);
  }

  async setActiveSite(userId: number, siteId: number): Promise<void> {
    const sites = readJSON<Site>("sites");
    const updated = sites.map((s) => {
      if (s.userId === userId) {
        return { ...s, isActive: s.id === siteId };
      }
      return s;
    });
    writeJSON("sites", updated);
  }

  async updateSitePrice(siteId: number, price: string): Promise<void> {
    const sites = readJSON<Site>("sites");
    const index = sites.findIndex((s) => s.id === siteId);
    if (index !== -1) {
      sites[index].productPrice = price;
      writeJSON("sites", sites);
    }
  }

  // Proxies
  async getUserProxies(userId: number): Promise<Proxy[]> {
    const proxies = readJSON<Proxy>("proxies");
    return proxies
      .filter((p) => p.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async addProxy(proxy: InsertProxy): Promise<Proxy> {
    const proxies = readJSON<Proxy>("proxies");
    const newProxy: Proxy = {
      id: generateId(proxies),
      userId: proxy.userId,
      proxy: proxy.proxy,
      isValid: proxy.isValid ?? true,
      lastChecked: proxy.lastChecked,
      createdAt: new Date(),
    };
    proxies.push(newProxy);
    writeJSON("proxies", proxies);
    return newProxy;
  }

  async updateProxy(id: number, data: Partial<InsertProxy>): Promise<void> {
    const proxies = readJSON<Proxy>("proxies");
    const index = proxies.findIndex((p) => p.id === id);
    if (index !== -1) {
      proxies[index] = { ...proxies[index], ...data };
      writeJSON("proxies", proxies);
    }
  }

  async deleteProxy(id: number): Promise<void> {
    const proxies = readJSON<Proxy>("proxies");
    const filtered = proxies.filter((p) => p.id !== id);
    writeJSON("proxies", filtered);
  }

  async deleteAllUserProxies(userId: number): Promise<void> {
    const proxies = readJSON<Proxy>("proxies");
    const filtered = proxies.filter((p) => p.userId !== userId);
    writeJSON("proxies", filtered);
  }

  // Settings (global fallback)
  async getSettings(): Promise<Settings | undefined> {
    const settingsList = readJSON<Settings>("settings");
    return settingsList[0];
  }

  async updateSettings(newSettings: InsertSettings): Promise<Settings> {
    const settingsList = readJSON<Settings>("settings");
    if (settingsList.length > 0) {
      settingsList[0] = {
        ...settingsList[0],
        ...newSettings,
        updatedAt: new Date(),
      };
      writeJSON("settings", settingsList);
      return settingsList[0];
    } else {
      const newSetting: Settings = {
        id: 1,
        targetUrl: newSettings.targetUrl || "",
        proxyList: newSettings.proxyList || "",
        proxyEnabled: newSettings.proxyEnabled ?? true,
        updatedAt: new Date(),
      };
      settingsList.push(newSetting);
      writeJSON("settings", settingsList);
      return newSetting;
    }
  }

  // Results
  async addResult(result: { card: string; status: string; message?: string; userId?: number; sessionId?: string }): Promise<CheckResult> {
    const results = readJSON<CheckResult>("results");
    const newResult: CheckResult = {
      id: generateId(results),
      card: result.card,
      status: result.status,
      message: result.message || "",
      userId: result.userId,
      sessionId: result.sessionId,
      createdAt: new Date(),
    };
    results.push(newResult);
    writeJSON("results", results);
    return newResult;
  }

  async getResults(limit = 100, userId?: number): Promise<CheckResult[]> {
    const results = readJSON<CheckResult>("results");
    let filtered = results;
    if (userId) {
      filtered = results.filter((r) => r.userId === userId);
    }
    return filtered
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  async clearResults(userId?: number): Promise<void> {
    const results = readJSON<CheckResult>("results");
    if (userId) {
      const filtered = results.filter((r) => r.userId !== userId);
      writeJSON("results", filtered);
    } else {
      writeJSON("results", []);
    }
  }

  // Check Sessions
  async createCheckSession(session: InsertCheckSession): Promise<CheckSession> {
    const sessions = readJSON<CheckSession>("checkSessions");
    const newSession: CheckSession = {
      id: generateId(sessions),
      sessionId: session.sessionId,
      userId: session.userId,
      siteId: session.siteId,
      totalCards: session.totalCards || 0,
      processedCards: session.processedCards || 0,
      chargedCards: session.chargedCards || 0,
      rejectedCards: session.rejectedCards || 0,
      status: session.status || "pending",
      createdAt: new Date(),
      completedAt: session.completedAt,
    };
    sessions.push(newSession);
    writeJSON("checkSessions", sessions);
    return newSession;
  }

  async updateCheckSession(sessionId: string, data: Partial<InsertCheckSession>): Promise<void> {
    const sessions = readJSON<CheckSession>("checkSessions");
    const index = sessions.findIndex((s) => s.sessionId === sessionId);
    if (index !== -1) {
      sessions[index] = { ...sessions[index], ...data };
      writeJSON("checkSessions", sessions);
    }
  }

  async getCheckSession(sessionId: string): Promise<CheckSession | undefined> {
    const sessions = readJSON<CheckSession>("checkSessions");
    return sessions.find((s) => s.sessionId === sessionId);
  }

  // Credit Transactions
  async addCreditTransaction(userId: number, amount: number, type: string, description?: string, adminId?: string): Promise<CreditTransaction> {
    const transactions = readJSON<CreditTransaction>("creditTransactions");
    const newTransaction: CreditTransaction = {
      id: generateId(transactions),
      userId,
      amount,
      type,
      description,
      adminId,
      createdAt: new Date(),
    };
    transactions.push(newTransaction);
    writeJSON("creditTransactions", transactions);
    return newTransaction;
  }

  async getCreditTransactions(userId: number, limit = 50): Promise<CreditTransaction[]> {
    const transactions = readJSON<CreditTransaction>("creditTransactions");
    return transactions
      .filter((t) => t.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  async getGlobalStats(): Promise<{ totalCards: number; totalLive: number; totalDead: number; hitRate: number }> {
    const users = readJSON<User>("users");
    const totalLive = users.reduce((sum, u) => sum + u.totalCharged, 0);
    const totalDead = users.reduce((sum, u) => sum + u.totalRejected, 0);
    const totalCards = totalLive + totalDead;
    const hitRate = totalCards > 0 ? (totalLive / totalCards) * 100 : 0;
    return { totalCards, totalLive, totalDead, hitRate };
  }

  async getLeaderboard(limit = 10): Promise<Array<{ userId: number; username: string | null; firstName: string | null; lastName: string | null; photoUrl: string | null; totalCharged: number; rank: number }>> {
    const users = readJSON<User>("users");
    const sorted = users
      .sort((a, b) => b.totalCharged - a.totalCharged)
      .slice(0, limit);
    return sorted.map((user, index) => ({
      userId: user.id,
      username: user.username || null,
      firstName: user.firstName || null,
      lastName: user.lastName || null,
      photoUrl: user.photoUrl || null,
      totalCharged: user.totalCharged,
      rank: index + 1,
    }));
  }

  // Referrals
  async getUserByReferralCode(code: string): Promise<User | undefined> {
    const users = readJSON<User>("users");
    return users.find((u) => u.referralCode === code);
  }

  async createReferral(referrerId: number, referredId: number, code: string): Promise<Referral> {
    const referrals = readJSON<Referral>("referrals");
    const newReferral: Referral = {
      id: generateId(referrals),
      referrerId,
      referredId,
      referralCode: code,
      creditsAwarded: 100,
      createdAt: new Date(),
    };
    referrals.push(newReferral);
    writeJSON("referrals", referrals);
    return newReferral;
  }

  async getReferralsByUser(userId: number): Promise<Referral[]> {
    const referrals = readJSON<Referral>("referrals");
    return referrals
      .filter((r) => r.referrerId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getReferralCount(userId: number): Promise<number> {
    const referrals = readJSON<Referral>("referrals");
    return referrals.filter((r) => r.referrerId === userId).length;
  }

  async generateReferralCode(userId: number): Promise<string> {
    const users = readJSON<User>("users");
    const user = users.find((u) => u.id === userId);
    if (user?.referralCode) {
      return user.referralCode;
    }
    const code = "NX" + Math.random().toString(36).substring(2, 8).toUpperCase();
    const index = users.findIndex((u) => u.id === userId);
    if (index !== -1) {
      users[index].referralCode = code;
      writeJSON("users", users);
    }
    return code;
  }

  // Daily Spin
  async getLastSpin(userId: number): Promise<DailySpin | undefined> {
    const spins = readJSON<DailySpin>("dailySpins");
    const userSpins = spins
      .filter((s) => s.userId === userId)
      .sort((a, b) => new Date(b.spinDate).getTime() - new Date(a.spinDate).getTime());
    return userSpins[0];
  }

  async canSpinToday(userId: number): Promise<boolean> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const spins = readJSON<DailySpin>("dailySpins");
    const hasSpunToday = spins.some(
      (s) => s.userId === userId && new Date(s.spinDate) >= today
    );
    return !hasSpunToday;
  }

  async recordSpin(userId: number, creditsWon: number): Promise<DailySpin> {
    const spins = readJSON<DailySpin>("dailySpins");
    const newSpin: DailySpin = {
      id: generateId(spins),
      userId,
      creditsWon,
      spinDate: new Date(),
    };
    spins.push(newSpin);
    writeJSON("dailySpins", spins);
    return newSpin;
  }

  // Daily Streak
  async getStreak(userId: number): Promise<DailyStreak | undefined> {
    const streaks = readJSON<DailyStreak>("dailyStreaks");
    return streaks.find((s) => s.userId === userId);
  }

  async claimStreak(userId: number): Promise<{ streak: DailyStreak; reward: number; canClaim: boolean }> {
    const streaks = readJSON<DailyStreak>("dailyStreaks");
    const existingIndex = streaks.findIndex((s) => s.userId === userId);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const streakRewards: { [key: number]: number } = {
      1: 30, 2: 30, 3: 45, 4: 45, 5: 45, 6: 45, 7: 70,
      8: 70, 9: 70, 10: 70, 11: 70, 12: 70, 13: 70, 14: 110,
      15: 110, 16: 110, 17: 110, 18: 110, 19: 110, 20: 110,
      21: 110, 22: 110, 23: 110, 24: 110, 25: 110, 26: 110,
      27: 110, 28: 110, 29: 110, 30: 210,
    };

    if (existingIndex === -1) {
      const newStreak: DailyStreak = {
        id: generateId(streaks),
        userId,
        currentStreak: 1,
        longestStreak: 1,
        lastClaimDate: now,
        totalClaimed: 1,
      };
      streaks.push(newStreak);
      writeJSON("dailyStreaks", streaks);
      const reward = streakRewards[1] || 30;
      return { streak: newStreak, reward, canClaim: true };
    }

    const streak = streaks[existingIndex];
    const lastClaim = streak.lastClaimDate ? new Date(streak.lastClaimDate) : null;
    const lastClaimDate = lastClaim ? new Date(lastClaim.getFullYear(), lastClaim.getMonth(), lastClaim.getDate()) : null;

    if (lastClaimDate && lastClaimDate.getTime() === today.getTime()) {
      return { streak, reward: 0, canClaim: false };
    }

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let newStreakValue = 1;
    if (lastClaimDate && lastClaimDate.getTime() === yesterday.getTime()) {
      newStreakValue = Math.min(streak.currentStreak + 1, 30);
    }

    const reward = streakRewards[newStreakValue] || 30;
    const longestStreak = Math.max(streak.longestStreak, newStreakValue);

    const updatedStreak: DailyStreak = {
      ...streak,
      currentStreak: newStreakValue,
      longestStreak,
      lastClaimDate: now,
      totalClaimed: streak.totalClaimed + 1,
    };

    streaks[existingIndex] = updatedStreak;
    writeJSON("dailyStreaks", streaks);

    return { streak: updatedStreak, reward, canClaim: true };
  }

  // Notification Settings
  async getNotificationSettings(userId: number): Promise<NotificationSettings | undefined> {
    const settings = readJSON<NotificationSettings>("notificationSettings");
    return settings.find((s) => s.userId === userId);
  }

  async updateNotificationSettings(userId: number, newSettings: Partial<NotificationSettings>): Promise<NotificationSettings> {
    const settings = readJSON<NotificationSettings>("notificationSettings");
    const existingIndex = settings.findIndex((s) => s.userId === userId);

    if (existingIndex !== -1) {
      settings[existingIndex] = {
        ...settings[existingIndex],
        ...newSettings,
        updatedAt: new Date(),
      };
      writeJSON("notificationSettings", settings);
      return settings[existingIndex];
    }

    const created: NotificationSettings = {
      id: generateId(settings),
      userId,
      approvedAlerts: newSettings.approvedAlerts ?? true,
      dailySummary: newSettings.dailySummary ?? false,
      streakReminder: newSettings.streakReminder ?? true,
      updatedAt: new Date(),
    };
    settings.push(created);
    writeJSON("notificationSettings", settings);
    return created;
  }
}

export const storage = new FileStorage();
