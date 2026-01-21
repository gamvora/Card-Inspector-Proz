import { useEffect, useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useStartCheck, useStopCheck, useClearResults, useCheckerSocket } from "@/hooks/use-checker";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  Play, 
  Square, 
  CreditCard, 
  Copy, 
  Coins,
  ChevronLeft,
  ChevronRight,
  Home as HomeIcon,
  User,
  Settings,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { useAuth, authFetch } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";

interface Site {
  id: number;
  name: string;
  url: string;
  isActive: boolean;
}

interface CheckResult {
  id: number;
  card: string;
  status: string;
  message?: string | null;
}


export default function Home() {
  const { user, refreshUser } = useAuth();
  const startCheck = useStartCheck();
  const stopCheck = useStopCheck();
  const { results, stats, clearLocalResults } = useCheckerSocket();
  const { toast } = useToast();

  const [cardsInput, setCardsInput] = useState("");
  const [selectedSiteIndex, setSelectedSiteIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<"live" | "dead">("live");
  const [lastChargedCount, setLastChargedCount] = useState(0);
  const prevResultsRef = useRef<CheckResult[]>([]);

  const { data: sites = [] } = useQuery<Site[]>({
    queryKey: ['/api/sites'],
    queryFn: async () => {
      const res = await authFetch('/api/sites');
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: userStats } = useQuery({
    queryKey: ['/api/stats'],
    queryFn: async () => {
      const res = await authFetch('/api/stats');
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (sites.length > 0) {
      const activeIndex = sites.findIndex(s => s.isActive);
      if (activeIndex >= 0) {
        setSelectedSiteIndex(activeIndex);
      }
    }
  }, [sites]);

  useEffect(() => {
    if (stats.charged !== undefined || stats.rejected !== undefined) {
      refreshUser();
    }
  }, [stats.charged, stats.rejected]);

  useEffect(() => {
    const liveResults = results.filter(r => r.status === 'live');
    const prevLiveResults = prevResultsRef.current.filter(r => r.status === 'live');
    
    if (liveResults.length > prevLiveResults.length) {
      const newLiveCards = liveResults.slice(prevLiveResults.length);
      
      newLiveCards.forEach((card) => {
        toast({
          title: "CHARGED!",
          description: (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="font-mono text-xs">{card.card.substring(0, 20)}...</span>
            </div>
          ),
          className: "bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800",
          soundType: 'success',
        });
      });
    }
    
    prevResultsRef.current = results;
  }, [results, toast]);

  const handleStart = async () => {
    if (!cardsInput.trim()) {
      toast({
        title: "Input Required",
        description: "Please enter cards to check.",
        variant: "destructive",
      });
      return;
    }
    
    const cards = cardsInput.split('\n').map(c => c.trim()).filter(c => c.length > 0);
    if (cards.length === 0) return;

    if (!user?.isAdmin && (user?.credits || 0) < cards.length) {
      toast({
        title: "Insufficient Credits",
        description: `You need ${cards.length} credits but only have ${user?.credits || 0}.`,
        variant: "destructive",
      });
      return;
    }
    
    clearLocalResults();
    prevResultsRef.current = [];
    const selectedSite = sites[selectedSiteIndex];
    startCheck.mutate({ cards, siteId: selectedSite?.id });
  };

  const handleStop = () => {
    stopCheck.mutate();
  };

  const liveResults = results.filter(r => r.status === 'live');
  const deadResults = results.filter(r => r.status === 'dead');

  const copyCard = (card: string) => {
    navigator.clipboard.writeText(card);
    toast({ title: "Copied!", duration: 1500 });
  };

  const selectedSite = sites[selectedSiteIndex];

  const nextSite = () => {
    if (sites.length > 0) {
      setSelectedSiteIndex((prev) => (prev + 1) % sites.length);
    }
  };

  const prevSite = () => {
    if (sites.length > 0) {
      setSelectedSiteIndex((prev) => (prev - 1 + sites.length) % sites.length);
    }
  };

  const displayedResults = activeTab === "live" ? liveResults : deadResults;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-rose-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col pb-20">
      
      <header className="px-4 pt-4 pb-2">
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-4"
        >
          <motion.div 
            whileHover={{ scale: 1.02 }}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-500/10 to-emerald-400/5 px-3 py-1.5 rounded-full border border-emerald-500/20"
          >
            <Coins className="w-4 h-4 text-emerald-500" />
            <motion.span 
              key={user?.credits}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              className="font-bold text-sm text-emerald-600 dark:text-emerald-400"
              data-testid="credits-balance"
            >
              {user?.credits || 0}
            </motion.span>
          </motion.div>
          
          <div className="flex items-center gap-4 text-xs">
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-full"
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {userStats?.totalCharged || 0}
              </span>
            </motion.div>
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-1.5 bg-rose-500/10 px-2.5 py-1 rounded-full"
            >
              <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
              <span className="font-bold text-rose-600 dark:text-rose-400">
                {userStats?.totalRejected || 0}
              </span>
            </motion.div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center mb-4"
        >
          <div className="inline-flex items-center gap-2">
            <motion.div
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              <Sparkles className="w-5 h-5 text-rose-400" />
            </motion.div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-rose-600 via-pink-500 to-purple-500 dark:from-rose-400 dark:via-pink-400 dark:to-purple-400 bg-clip-text text-transparent">
              NexusChecker
            </h1>
            <motion.div
              animate={{ rotate: [0, -15, 15, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              <Sparkles className="w-5 h-5 text-purple-400" />
            </motion.div>
          </div>
        </motion.div>
      </header>

      <main className="flex-1 px-4 space-y-4">
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/50 shadow-lg shadow-slate-200/50 dark:shadow-none overflow-hidden"
        >
          <Textarea 
            value={cardsInput}
            onChange={(e) => setCardsInput(e.target.value)}
            placeholder="Paste your cards here...&#10;Format: 4111111111111111|12|2025|123"
            className="border-0 min-h-[120px] resize-none bg-transparent focus-visible:ring-0 font-mono text-sm p-4 leading-relaxed placeholder:text-slate-400"
            spellCheck={false}
            data-testid="input-cards"
          />
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 dark:border-slate-700/50 bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-800/30">
            <button className="p-2 rounded-lg hover-elevate">
              <Upload className="w-4 h-4 text-slate-400" />
            </button>
            <motion.span 
              key={cardsInput.split('\n').filter(l => l.trim().length > 0).length}
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
              className="text-xs font-mono px-2 py-1 bg-slate-200/50 dark:bg-slate-700/50 rounded-md text-slate-500"
            >
              {cardsInput.split('\n').filter(l => l.trim().length > 0).length} cards
            </motion.span>
            <Link href="/settings">
              <button className="p-2 rounded-lg hover-elevate">
                <Settings className="w-4 h-4 text-slate-400" />
              </button>
            </Link>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex items-center justify-center gap-3"
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={prevSite}
            disabled={sites.length <= 1}
            className="rounded-full h-10 w-10 border border-slate-200 dark:border-slate-700"
            data-testid="button-prev-site"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          
          <AnimatePresence mode="wait">
            <motion.div 
              key={selectedSiteIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 max-w-[200px]"
            >
              {sites.length === 0 ? (
                <Link href="/settings">
                  <div className="text-center text-sm text-slate-400 py-2.5 px-4 bg-slate-100 dark:bg-slate-800 rounded-xl cursor-pointer border-2 border-dashed border-slate-300 dark:border-slate-600">
                    + Add Site
                  </div>
                </Link>
              ) : (
                <div className="text-center py-2.5 px-4 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-center gap-2">
                    <CreditCard className="w-4 h-4 text-rose-500" />
                    <span className="font-semibold text-sm truncate" data-testid="selected-site-name">
                      {selectedSite?.name || 'Select'}
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={nextSite}
            disabled={sites.length <= 1}
            className="rounded-full h-10 w-10 border border-slate-200 dark:border-slate-700"
            data-testid="button-next-site"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex gap-3"
        >
          <Button 
            onClick={handleStart}
            disabled={stats.active || startCheck.isPending || sites.length === 0}
            className="flex-1 h-12 rounded-xl font-semibold text-base bg-gradient-to-r from-rose-500 to-pink-500 dark:from-rose-600 dark:to-pink-600 text-white shadow-lg shadow-rose-500/20 border-0"
            data-testid="button-start"
          >
            {stats.active ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <Play className="w-5 h-5 mr-2 fill-current" />
                Start
              </>
            )}
          </Button>

          <Button 
            onClick={handleStop}
            disabled={!stats.active || stopCheck.isPending}
            variant="outline"
            className="h-12 px-6 rounded-xl font-semibold border-2 border-slate-300 dark:border-slate-600"
            data-testid="button-stop"
          >
            <Square className="w-5 h-5" />
          </Button>
        </motion.div>

        {stats.active && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="text-center text-sm text-slate-500"
          >
            <span className="font-mono">{stats.processed}</span>
            <span className="text-slate-400"> / </span>
            <span className="font-mono">{stats.total}</span>
            <span className="text-slate-400 ml-2">processed</span>
          </motion.div>
        )}

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="flex gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl"
        >
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab("live")}
            className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              activeTab === "live"
                ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-md"
                : "text-slate-500"
            }`}
            data-testid="tab-live"
          >
            <CheckCircle2 className="w-4 h-4" />
            APPROVED ({liveResults.length})
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab("dead")}
            className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              activeTab === "dead"
                ? "bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-md"
                : "text-slate-500"
            }`}
            data-testid="tab-dead"
          >
            <XCircle className="w-4 h-4" />
            DECLINED ({deadResults.length})
          </motion.button>
        </motion.div>

        <div className="space-y-3 pb-4">
          <AnimatePresence mode="popLayout">
            {displayedResults.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-16"
              >
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                    activeTab === "live" 
                      ? "bg-emerald-100 dark:bg-emerald-500/20" 
                      : "bg-rose-100 dark:bg-rose-500/20"
                  }`}
                >
                  {activeTab === "live" ? (
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                  ) : (
                    <XCircle className="w-8 h-8 text-rose-500" />
                  )}
                </motion.div>
                <p className="text-slate-400 text-sm">
                  {activeTab === "live" ? "No approved cards yet" : "No declined cards yet"}
                </p>
              </motion.div>
            ) : (
              displayedResults.map((result, index) => (
                <motion.div
                  key={result.id}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ delay: index * 0.02 }}
                  className={`rounded-2xl p-4 shadow-sm border ${
                    result.status === 'live' 
                      ? 'bg-gradient-to-r from-emerald-50 to-emerald-100/50 dark:from-emerald-500/10 dark:to-emerald-500/5 border-emerald-200 dark:border-emerald-500/20' 
                      : 'bg-gradient-to-r from-rose-50 to-rose-100/50 dark:from-rose-500/10 dark:to-rose-500/5 border-rose-200 dark:border-rose-500/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <motion.span 
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className={`w-3 h-3 rounded-full ${
                            result.status === 'live' ? 'bg-emerald-500' : 'bg-rose-500'
                          }`} 
                        />
                        <p className="font-mono text-xs font-medium truncate text-slate-700 dark:text-slate-200">
                          {result.card}
                        </p>
                      </div>
                      <p className={`text-sm font-bold ${
                        result.status === 'live' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}>
                        {result.status === 'live' ? 'APPROVED' : 'DECLINED'}
                      </p>
                      {result.message && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-1">{result.message}</p>
                      )}
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => copyCard(result.card)}
                      className={`p-2.5 rounded-xl ${
                        result.status === 'live' 
                          ? 'bg-emerald-200/50 dark:bg-emerald-500/20' 
                          : 'bg-rose-200/50 dark:bg-rose-500/20'
                      }`}
                    >
                      <Copy className={`w-4 h-4 ${
                        result.status === 'live' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`} />
                    </motion.button>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-700/50 px-4 py-3 z-50">
        <div className="flex items-center justify-around max-w-md mx-auto">
          <Link href="/">
            <motion.button 
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-1.5 py-1 px-8"
              data-testid="nav-home"
            >
              <div className="p-2 rounded-xl bg-rose-500/10">
                <HomeIcon className="w-5 h-5 text-rose-500" />
              </div>
              <span className="text-[10px] font-semibold text-rose-500">Home</span>
            </motion.button>
          </Link>
          <Link href="/profile">
            <motion.button 
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-1.5 py-1 px-8"
              data-testid="nav-profile"
            >
              <div className="p-2">
                <User className="w-5 h-5 text-slate-400" />
              </div>
              <span className="text-[10px] font-medium text-slate-400">Profile</span>
            </motion.button>
          </Link>
          <Link href="/settings">
            <motion.button 
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-1.5 py-1 px-8"
              data-testid="nav-settings"
            >
              <div className="p-2">
                <Settings className="w-5 h-5 text-slate-400" />
              </div>
              <span className="text-[10px] font-medium text-slate-400">Settings</span>
            </motion.button>
          </Link>
        </div>
      </nav>

    </div>
  );
}
