import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useAuth, authFetch } from "@/lib/auth";
import { Link } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Home as HomeIcon,
  User,
  Settings as SettingsIcon,
  Crown,
  TrendingUp,
  TrendingDown,
  Coins,
  BarChart3,
  Target,
  Zap,
  Award,
  Activity,
  Calendar,
  Shield,
} from "lucide-react";

export default function Profile() {
  const { user } = useAuth();

  const { data: userStats } = useQuery({
    queryKey: ["/api/stats"],
    queryFn: async () => {
      const res = await authFetch("/api/stats");
      if (!res.ok) return null;
      return res.json();
    },
  });

  const totalChecked = (userStats?.totalCharged || 0) + (userStats?.totalRejected || 0);
  const successRate = totalChecked > 0 
    ? ((userStats?.totalCharged || 0) / totalChecked * 100) 
    : 0;

  const getTelegramPhotoUrl = () => {
    if (!user?.telegramId) return null;
    return null;
  };

  const getInitials = () => {
    if (user?.firstName) {
      return (user.firstName[0] + (user.lastName?.[0] || "")).toUpperCase();
    }
    if (user?.username) {
      return user.username.slice(0, 2).toUpperCase();
    }
    return "U";
  };

  const getMembershipStatus = () => {
    return "Active";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/30 pb-24">
      
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-pink-500/20 dark:from-indigo-500/10 dark:via-purple-500/5 dark:to-pink-500/10" />
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-10 left-10 w-32 h-32 bg-indigo-400/20 rounded-full blur-3xl" />
          <div className="absolute top-20 right-10 w-24 h-24 bg-pink-400/20 rounded-full blur-3xl" />
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative pt-8 pb-6 px-6 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", duration: 0.6 }}
            className="relative inline-block mb-4"
          >
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full blur opacity-75 animate-pulse" />
            <Avatar className="relative w-24 h-24 border-4 border-white dark:border-slate-800 shadow-2xl">
              <AvatarImage src={getTelegramPhotoUrl() || undefined} />
              <AvatarFallback className="text-2xl font-bold bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            {user?.isAdmin && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3 }}
                className="absolute -top-1 -right-1 w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg"
              >
                <Crown className="w-4 h-4 text-white" />
              </motion.div>
            )}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-2xl font-bold text-slate-900 dark:text-white mb-1"
          >
            {user?.firstName} {user?.lastName}
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="text-indigo-600 dark:text-indigo-400 font-medium"
          >
            @{user?.username || user?.telegramId}
          </motion.p>

          {user?.isAdmin && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-1.5 mt-3 px-4 py-1.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-full"
            >
              <Shield className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400">ADMIN</span>
            </motion.div>
          )}
        </motion.div>
      </div>

      <main className="px-4 -mt-2 space-y-4">
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-3 gap-3"
        >
          <Card className="p-4 text-center bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 border-amber-200/50 dark:border-amber-500/20 rounded-2xl">
            <div className="w-10 h-10 mx-auto mb-2 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Coins className="w-5 h-5 text-white" />
            </div>
            <motion.p
              key={user?.credits}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              className="text-xl font-bold text-amber-600 dark:text-amber-400"
              data-testid="profile-credits"
            >
              {user?.credits?.toLocaleString() || 0}
            </motion.p>
            <p className="text-[10px] font-medium text-amber-600/70 uppercase tracking-wide">Credits</p>
          </Card>

          <Card className="p-4 text-center bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-500/10 dark:to-green-500/10 border-emerald-200/50 dark:border-emerald-500/20 rounded-2xl">
            <div className="w-10 h-10 mx-auto mb-2 bg-gradient-to-br from-emerald-400 to-green-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <motion.p
              key={userStats?.totalCharged}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              className="text-xl font-bold text-emerald-600 dark:text-emerald-400"
              data-testid="profile-approved"
            >
              {(userStats?.totalCharged || 0).toLocaleString()}
            </motion.p>
            <p className="text-[10px] font-medium text-emerald-600/70 uppercase tracking-wide">Approved</p>
          </Card>

          <Card className="p-4 text-center bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-500/10 dark:to-red-500/10 border-rose-200/50 dark:border-rose-500/20 rounded-2xl">
            <div className="w-10 h-10 mx-auto mb-2 bg-gradient-to-br from-rose-400 to-red-500 rounded-xl flex items-center justify-center shadow-lg shadow-rose-500/20">
              <TrendingDown className="w-5 h-5 text-white" />
            </div>
            <motion.p
              key={userStats?.totalRejected}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              className="text-xl font-bold text-rose-600 dark:text-rose-400"
              data-testid="profile-declined"
            >
              {(userStats?.totalRejected || 0).toLocaleString()}
            </motion.p>
            <p className="text-[10px] font-medium text-rose-600/70 uppercase tracking-wide">Declined</p>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card className="p-5 rounded-3xl bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-lg">Statistics</h2>
                <p className="text-xs text-slate-400">Your performance overview</p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Success Rate</span>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {successRate.toFixed(1)}%
                  </span>
                </div>
                <div className="relative h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${successRate}%` }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-400 to-green-500 rounded-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4 text-indigo-500" />
                    <span className="text-xs font-medium text-slate-500">Total Checked</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {totalChecked.toLocaleString()}
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-medium text-slate-500">Hit Rate</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {successRate.toFixed(1)}%
                  </p>
                </div>
              </div>

              <div className="relative pt-4">
                <div className="flex justify-center items-end gap-3 h-32">
                  <div className="flex flex-col items-center gap-2">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.min((userStats?.totalCharged || 1) / Math.max(totalChecked, 1) * 100, 100)}%` }}
                      transition={{ duration: 0.8, delay: 0.3 }}
                      className="w-12 bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-t-lg min-h-[20px]"
                      style={{ maxHeight: "100px" }}
                    />
                    <span className="text-xs font-medium text-slate-500">Live</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.min((userStats?.totalRejected || 1) / Math.max(totalChecked, 1) * 100, 100)}%` }}
                      transition={{ duration: 0.8, delay: 0.4 }}
                      className="w-12 bg-gradient-to-t from-rose-500 to-rose-400 rounded-t-lg min-h-[20px]"
                      style={{ maxHeight: "100px" }}
                    />
                    <span className="text-xs font-medium text-slate-500">Dead</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-5 rounded-3xl bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-lg">Account Info</h2>
                <p className="text-xs text-slate-400">Your membership details</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                    <User className="w-4 h-4 text-slate-500" />
                  </div>
                  <span className="text-sm text-slate-600 dark:text-slate-300">Username</span>
                </div>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  @{user?.username || "N/A"}
                </span>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-slate-500" />
                  </div>
                  <span className="text-sm text-slate-600 dark:text-slate-300">Account Status</span>
                </div>
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  {getMembershipStatus()}
                </span>
              </div>

              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                    <Award className="w-4 h-4 text-slate-500" />
                  </div>
                  <span className="text-sm text-slate-600 dark:text-slate-300">Status</span>
                </div>
                <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                  user?.isAdmin 
                    ? "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400" 
                    : "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                }`}>
                  {user?.isAdmin ? "Admin" : "Member"}
                </span>
              </div>
            </div>
          </Card>
        </motion.div>

      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-700/50 px-4 py-3 z-50">
        <div className="flex items-center justify-around max-w-md mx-auto">
          <Link href="/">
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-1.5 py-1 px-8"
              data-testid="nav-home"
            >
              <div className="p-2">
                <HomeIcon className="w-5 h-5 text-slate-400" />
              </div>
              <span className="text-[10px] font-medium text-slate-400">Home</span>
            </motion.button>
          </Link>
          <Link href="/profile">
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-1.5 py-1 px-8"
              data-testid="nav-profile"
            >
              <div className="p-2 rounded-xl bg-indigo-500/10">
                <User className="w-5 h-5 text-indigo-500" />
              </div>
              <span className="text-[10px] font-semibold text-indigo-500">Profile</span>
            </motion.button>
          </Link>
          <Link href="/settings">
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-1.5 py-1 px-8"
              data-testid="nav-settings"
            >
              <div className="p-2">
                <SettingsIcon className="w-5 h-5 text-slate-400" />
              </div>
              <span className="text-[10px] font-medium text-slate-400">Settings</span>
            </motion.button>
          </Link>
        </div>
      </nav>
    </div>
  );
}
