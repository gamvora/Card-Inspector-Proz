import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth, authFetch } from "@/lib/auth";
import { Link } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  Home as HomeIcon,
  User,
  Settings as SettingsIcon,
  Crown,
  TrendingUp,
  Zap,
  BarChart3,
  Target,
  Activity,
  Globe,
  Users,
  ChevronDown,
  ChevronUp,
  Gift,
  Star,
  Shield,
} from "lucide-react";

type ChartType = "bar" | "donut" | "area";

interface GlobalStats {
  totalCards: number;
  totalLive: number;
  totalDead: number;
  hitRate: number;
}

interface LeaderboardUser {
  userId: number;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
  totalCharged: number;
  rank: number;
}

interface OnlineUser {
  telegramId: string;
  userId: number;
  username: string | null;
  firstName: string | null;
  photoUrl: string | null;
  isAdmin?: boolean;
}

export default function Profile() {
  const { user } = useAuth();
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [showAllOnline, setShowAllOnline] = useState(false);

  const { data: userStats } = useQuery({
    queryKey: ["/api/stats"],
    queryFn: async () => {
      const res = await authFetch("/api/stats");
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: globalStats } = useQuery<GlobalStats>({
    queryKey: ["/api/stats/global"],
    queryFn: async () => {
      const res = await authFetch("/api/stats/global");
      if (!res.ok) return { totalCards: 0, totalLive: 0, totalDead: 0, hitRate: 0 };
      return res.json();
    },
  });

  const { data: leaderboard = [] } = useQuery<LeaderboardUser[]>({
    queryKey: ["/api/leaderboard"],
    queryFn: async () => {
      const res = await authFetch("/api/leaderboard");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: onlineUsers = [] } = useQuery<OnlineUser[]>({
    queryKey: ["/api/online-users"],
    queryFn: async () => {
      const res = await authFetch("/api/online-users");
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 10000, // Update every 10 seconds
  });

  const totalChecked = (userStats?.totalCharged || 0) + (userStats?.totalRejected || 0);
  const successRate = totalChecked > 0 
    ? ((userStats?.totalCharged || 0) / totalChecked * 100) 
    : 0;

  const getInitials = () => {
    if (user?.firstName) {
      return (user.firstName[0] + (user.lastName?.[0] || "")).toUpperCase();
    }
    if (user?.username) {
      return user.username.slice(0, 2).toUpperCase();
    }
    return "U";
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return "from-amber-400 to-yellow-500";
    if (rank === 2) return "from-slate-300 to-slate-400";
    if (rank === 3) return "from-orange-400 to-amber-600";
    return "from-slate-500 to-slate-600";
  };

  const getRankBg = (rank: number) => {
    if (rank === 1) return "bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-500/10 dark:to-yellow-500/10 border-amber-200/50 dark:border-amber-500/20";
    if (rank === 2) return "bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-500/10 dark:to-gray-500/10 border-slate-200/50 dark:border-slate-500/20";
    if (rank === 3) return "bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-500/10 dark:to-amber-500/10 border-orange-200/50 dark:border-orange-500/20";
    return "bg-white/50 dark:bg-slate-800/50";
  };

  const displayedOnlineUsers = showAllOnline ? onlineUsers : onlineUsers.slice(0, 3);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--muted-foreground) / 0.1) 1px, transparent 0)', backgroundSize: '20px 20px' }} />
      </div>

      <main className="relative px-4 pt-6 space-y-5">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-emerald-500" />
            <h2 className="font-bold text-lg">Online Users</h2>
            <span className="ml-auto text-xs text-muted-foreground">{onlineUsers.length} online</span>
          </div>

          <Card className="p-4 rounded-2xl bg-card/80 backdrop-blur-sm border-border/50">
            <div className="space-y-3">
              <AnimatePresence>
                {displayedOnlineUsers.map((onlineUser, index) => (
                  <motion.div
                    key={onlineUser.telegramId}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors ${
                      onlineUser.isAdmin ? 'bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30' : ''
                    }`}
                    data-testid={`online-user-${onlineUser.telegramId}`}
                  >
                    <div className="relative">
                      <Avatar className={`w-10 h-10 border-2 ${onlineUser.isAdmin ? 'border-amber-500' : 'border-background'}`}>
                        <AvatarImage src={onlineUser.photoUrl || undefined} alt={onlineUser.firstName || "User"} />
                        <AvatarFallback className={`text-sm font-bold ${
                          onlineUser.isAdmin 
                            ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white' 
                            : 'bg-gradient-to-br from-primary/20 to-accent/20'
                        }`}>
                          {onlineUser.firstName?.[0] || onlineUser.username?.[0] || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${
                        onlineUser.isAdmin ? 'bg-amber-500' : 'bg-emerald-500'
                      }`} />
                      {onlineUser.isAdmin && (
                        <div className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center border-2 border-background shadow-lg">
                          <Crown className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`font-semibold text-sm truncate ${onlineUser.isAdmin ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                          {onlineUser.firstName || "User"}
                        </p>
                        {onlineUser.isAdmin && (
                          <motion.span 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30 flex items-center gap-1"
                          >
                            <Star className="w-2.5 h-2.5 fill-current" />
                            OWNER
                          </motion.span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">@{onlineUser.username || onlineUser.telegramId}</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {onlineUsers.length > 3 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllOnline(!showAllOnline)}
                  className="w-full text-muted-foreground hover:text-foreground"
                  data-testid="button-show-more-online"
                >
                  {showAllOnline ? (
                    <>Hide <ChevronUp className="w-4 h-4 ml-1" /></>
                  ) : (
                    <>Show {onlineUsers.length - 3} More Users <ChevronDown className="w-4 h-4 ml-1" /></>
                  )}
                </Button>
              )}

              {onlineUsers.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-4">No users online</p>
              )}
            </div>
          </Card>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Crown className="w-5 h-5 text-amber-500" />
            <h2 className="font-bold text-lg">Top Karders</h2>
          </div>

          <Card className="p-4 rounded-2xl bg-card/80 backdrop-blur-sm border-border/50">
            <div className="space-y-3">
              {leaderboard.slice(0, 5).map((leader, index) => (
                <motion.div
                  key={leader.userId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${getRankBg(leader.rank)}`}
                  data-testid={`leaderboard-user-${leader.rank}`}
                >
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getRankColor(leader.rank)} flex items-center justify-center text-white font-bold text-sm shadow-lg`}>
                    #{leader.rank}
                  </div>
                  <Avatar className="w-10 h-10 border-2 border-background">
                    <AvatarImage src={leader.photoUrl || undefined} alt={leader.firstName || "User"} />
                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-sm font-bold">
                      {leader.firstName?.[0] || leader.username?.[0] || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{leader.firstName || "User"}</p>
                    <p className="text-xs text-muted-foreground truncate">@{leader.username || `user${leader.userId}`}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-600 dark:text-emerald-400">{leader.totalCharged.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">live cards</p>
                  </div>
                </motion.div>
              ))}

              {leaderboard.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-4">No data available</p>
              )}
            </div>
          </Card>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-indigo-500" />
            <h2 className="font-bold text-lg">Statistics</h2>
          </div>

          <Card className="p-5 rounded-2xl bg-card/80 backdrop-blur-sm border-border/50">
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
                <p className="text-xs text-muted-foreground uppercase mb-1">Total Cards</p>
                <p className="text-2xl font-bold" data-testid="stat-total-cards">{totalChecked.toLocaleString()}</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
                <p className="text-xs text-muted-foreground uppercase mb-1">Hit Rate</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400" data-testid="stat-hit-rate">{successRate.toFixed(1)}%</p>
                <p className="text-[10px] text-muted-foreground">{((globalStats?.hitRate || 0) - successRate).toFixed(1)}% vs global</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
                <p className="text-xs text-muted-foreground uppercase mb-1">Live Cards</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400" data-testid="stat-live-cards">{(userStats?.totalCharged || 0).toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">Hits on site</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
                <p className="text-xs text-muted-foreground uppercase mb-1">Global Avg</p>
                <p className="text-2xl font-bold" data-testid="stat-global-avg">{(globalStats?.hitRate || 0).toFixed(1)}%</p>
                <p className="text-[10px] text-muted-foreground">{(globalStats?.totalCards || 0).toLocaleString()} total</p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 mb-5 p-1 bg-muted/50 rounded-xl">
              <Button
                variant={chartType === "bar" ? "default" : "ghost"}
                size="sm"
                onClick={() => setChartType("bar")}
                className="flex-1 rounded-lg"
                data-testid="button-chart-bar"
              >
                <BarChart3 className="w-4 h-4" />
              </Button>
              <Button
                variant={chartType === "donut" ? "default" : "ghost"}
                size="sm"
                onClick={() => setChartType("donut")}
                className="flex-1 rounded-lg"
                data-testid="button-chart-donut"
              >
                <Target className="w-4 h-4" />
              </Button>
              <Button
                variant={chartType === "area" ? "default" : "ghost"}
                size="sm"
                onClick={() => setChartType("area")}
                className="flex-1 rounded-lg"
                data-testid="button-chart-area"
              >
                <TrendingUp className="w-4 h-4" />
              </Button>
            </div>

            <AnimatePresence mode="wait">
              {chartType === "bar" && (
                <motion.div
                  key="bar"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="h-48"
                >
                  <div className="flex items-end justify-around h-40 gap-8">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-end gap-1">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${Math.min((totalChecked / Math.max(globalStats?.totalCards || 1, 1)) * 100, 100)}%` }}
                          transition={{ duration: 0.8 }}
                          className="w-8 bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t"
                          style={{ minHeight: "20px", maxHeight: "120px" }}
                        />
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: "100%" }}
                          transition={{ duration: 0.8, delay: 0.1 }}
                          className="w-8 bg-gradient-to-t from-amber-500 to-amber-400 rounded-t"
                          style={{ minHeight: "20px", maxHeight: "120px" }}
                        />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">Total</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-end gap-1">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${Math.min((userStats?.totalCharged || 0) / Math.max(globalStats?.totalLive || 1, 1) * 100, 100)}%` }}
                          transition={{ duration: 0.8, delay: 0.2 }}
                          className="w-8 bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t"
                          style={{ minHeight: "20px", maxHeight: "120px" }}
                        />
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: "100%" }}
                          transition={{ duration: 0.8, delay: 0.3 }}
                          className="w-8 bg-gradient-to-t from-amber-500 to-amber-400 rounded-t"
                          style={{ minHeight: "20px", maxHeight: "120px" }}
                        />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">Live</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-end gap-1">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${Math.min((userStats?.totalRejected || 0) / Math.max(globalStats?.totalDead || 1, 1) * 100, 100)}%` }}
                          transition={{ duration: 0.8, delay: 0.4 }}
                          className="w-8 bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t"
                          style={{ minHeight: "20px", maxHeight: "120px" }}
                        />
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: "100%" }}
                          transition={{ duration: 0.8, delay: 0.5 }}
                          className="w-8 bg-gradient-to-t from-amber-500 to-amber-400 rounded-t"
                          style={{ minHeight: "20px", maxHeight: "120px" }}
                        />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">Dead</span>
                    </div>
                  </div>
                  <div className="flex justify-center gap-6 mt-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm bg-indigo-500" />
                      <span className="text-xs text-muted-foreground">Your Stats</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm bg-amber-500" />
                      <span className="text-xs text-muted-foreground">Global Stats</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {chartType === "donut" && (
                <motion.div
                  key="donut"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="h-48 flex flex-col items-center justify-center"
                >
                  <div className="relative w-40 h-40">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke="hsl(var(--destructive) / 0.3)"
                        strokeWidth="12"
                      />
                      <motion.circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke="hsl(var(--primary))"
                        strokeWidth="12"
                        strokeLinecap="round"
                        initial={{ strokeDasharray: "0 251" }}
                        animate={{ strokeDasharray: `${successRate * 2.51} 251` }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold">{successRate.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="flex justify-center gap-6 mt-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-primary" />
                      <span className="text-xs text-muted-foreground">Your Live</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-destructive/30" />
                      <span className="text-xs text-muted-foreground">Your Dead</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {chartType === "area" && (
                <motion.div
                  key="area"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="h-48"
                >
                  <div className="relative h-40 w-full">
                    <svg className="w-full h-full" viewBox="0 0 100 60" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="areaGradientRed" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <motion.path
                        d="M0,60 L0,50 C20,40 40,30 60,20 C80,10 90,5 100,5 L100,60 Z"
                        fill="url(#areaGradientRed)"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1 }}
                      />
                      <motion.path
                        d="M0,60 L0,55 C20,50 40,40 60,30 C80,20 90,15 100,10 L100,60 Z"
                        fill="url(#areaGradient)"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1, delay: 0.3 }}
                      />
                      <motion.path
                        d="M0,55 C20,50 40,40 60,30 C80,20 90,15 100,10"
                        fill="none"
                        stroke="hsl(var(--primary))"
                        strokeWidth="1"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.5 }}
                      />
                      <motion.path
                        d="M0,50 C20,40 40,30 60,20 C80,10 90,5 100,5"
                        fill="none"
                        stroke="hsl(var(--destructive))"
                        strokeWidth="1"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.5, delay: 0.2 }}
                      />
                    </svg>
                    <div className="absolute bottom-0 left-0 text-xs text-muted-foreground">Your Stats</div>
                    <div className="absolute bottom-0 right-0 text-xs text-muted-foreground">Global Stats</div>
                  </div>
                  <div className="flex justify-center gap-6 mt-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-primary" />
                      <span className="text-xs text-muted-foreground">Live</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-destructive" />
                      <span className="text-xs text-muted-foreground">Dead</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.section>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-xl border-t border-border/50 px-4 py-3 z-50">
        <div className="flex items-center justify-around max-w-md mx-auto">
          <Link href="/">
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-1.5 py-1 px-6"
              data-testid="nav-home"
            >
              <div className="p-2">
                <HomeIcon className="w-5 h-5 text-muted-foreground" />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground">Home</span>
            </motion.button>
          </Link>
          <Link href="/rewards">
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-1.5 py-1 px-6"
              data-testid="nav-rewards"
            >
              <div className="p-2">
                <Gift className="w-5 h-5 text-muted-foreground" />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground">Rewards</span>
            </motion.button>
          </Link>
          <Link href="/profile">
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-1.5 py-1 px-6"
              data-testid="nav-profile"
            >
              <div className="p-2 rounded-xl bg-primary/10">
                <User className="w-5 h-5 text-primary" />
              </div>
              <span className="text-[10px] font-semibold text-primary">Profile</span>
            </motion.button>
          </Link>
          <Link href="/settings">
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-1.5 py-1 px-6"
              data-testid="nav-settings"
            >
              <div className="p-2">
                <SettingsIcon className="w-5 h-5 text-muted-foreground" />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground">Settings</span>
            </motion.button>
          </Link>
        </div>
      </nav>
    </div>
  );
}
