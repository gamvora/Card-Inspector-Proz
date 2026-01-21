import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useStartCheck, useStopCheck, useClearResults, useCheckerSocket } from "@/hooks/use-checker";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  Play, 
  Square, 
  CreditCard, 
  Copy, 
  CheckCheck,
  Coins,
  ChevronLeft,
  ChevronRight,
  Home as HomeIcon,
  User,
  Settings,
  Sparkles,
  TrendingUp,
  Upload,
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

export default function Home() {
  const { user, refreshUser } = useAuth();
  const startCheck = useStartCheck();
  const stopCheck = useStopCheck();
  const { results, stats, clearLocalResults } = useCheckerSocket();
  const { toast } = useToast();

  const [cardsInput, setCardsInput] = useState("");
  const [selectedSiteIndex, setSelectedSiteIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<"live" | "dead">("live");

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
    toast({ title: "Copied!" });
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-pink-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col pb-20">
      
      <header className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
            <Coins className="w-4 h-4 text-emerald-500" />
            <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400" data-testid="credits-balance">
              {user?.credits || 0}
            </span>
          </div>
          
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="font-semibold">{userStats?.totalCharged || 0}</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <User className="w-3.5 h-3.5" />
              <span className="font-semibold">{userStats?.totalRejected || 0}</span>
            </div>
          </div>
        </div>

        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-pink-400" />
            <h1 className="text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
              NexusChecker
            </h1>
            <Sparkles className="w-4 h-4 text-cyan-400" />
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 space-y-4">
        
        <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/50 shadow-sm overflow-hidden">
          <Textarea 
            value={cardsInput}
            onChange={(e) => setCardsInput(e.target.value)}
            placeholder="Paste your cards here...&#10;We will extract and validate them"
            className="border-0 min-h-[100px] resize-none bg-transparent focus-visible:ring-0 font-mono text-sm p-4 leading-relaxed placeholder:text-slate-400"
            spellCheck={false}
            data-testid="input-cards"
          />
          <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30">
            <button className="p-2 rounded-lg hover-elevate">
              <Upload className="w-4 h-4 text-slate-400" />
            </button>
            <span className="text-xs font-mono text-slate-400">
              {cardsInput.split('\n').filter(l => l.trim().length > 0).length} cards
            </span>
            <Link href="/settings">
              <button className="p-2 rounded-lg hover-elevate">
                <Settings className="w-4 h-4 text-slate-400" />
              </button>
            </Link>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={prevSite}
            disabled={sites.length <= 1}
            className="rounded-full h-9 w-9"
            data-testid="button-prev-site"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          
          <div className="flex-1 max-w-[200px]">
            {sites.length === 0 ? (
              <Link href="/settings">
                <div className="text-center text-sm text-slate-400 py-2 px-4 bg-slate-100 dark:bg-slate-800 rounded-xl cursor-pointer">
                  + Add Site
                </div>
              </Link>
            ) : (
              <div className="text-center py-2 px-4 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <div className="flex items-center justify-center gap-2">
                  <CreditCard className="w-4 h-4 text-slate-500" />
                  <span className="font-medium text-sm truncate" data-testid="selected-site-name">
                    {selectedSite?.name || 'Select'}
                  </span>
                </div>
              </div>
            )}
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={nextSite}
            disabled={sites.length <= 1}
            className="rounded-full h-9 w-9"
            data-testid="button-next-site"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex gap-3">
          <Button 
            onClick={handleStart}
            disabled={stats.active || startCheck.isPending || sites.length === 0}
            className="flex-1 h-11 rounded-xl font-medium bg-slate-800 dark:bg-slate-700 text-white"
            data-testid="button-start"
          >
            <Play className="w-4 h-4 mr-2 fill-current" />
            Start
          </Button>

          <Button 
            onClick={handleStop}
            disabled={!stats.active || stopCheck.isPending}
            variant="outline"
            className="flex-1 h-11 rounded-xl font-medium border-slate-300 dark:border-slate-600"
            data-testid="button-stop"
          >
            <Square className="w-4 h-4 mr-2" />
            Stop
          </Button>
        </div>

        {stats.active && (
          <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Processing...</span>
              <span className="font-mono">{stats.processed}/{stats.total}</span>
            </div>
            <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-emerald-500"
                initial={{ width: 0 }}
                animate={{ width: `${stats.total > 0 ? (stats.processed / stats.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          <button
            onClick={() => setActiveTab("live")}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === "live"
                ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                : "text-slate-500"
            }`}
            data-testid="tab-live"
          >
            APPROVED ({liveResults.length})
          </button>
          <button
            onClick={() => setActiveTab("dead")}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === "dead"
                ? "bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm"
                : "text-slate-500"
            }`}
            data-testid="tab-dead"
          >
            DECLINED ({deadResults.length})
          </button>
        </div>

        <div className="space-y-2 pb-4">
          <AnimatePresence mode="popLayout">
            {displayedResults.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                {activeTab === "live" ? "No approved cards yet" : "No declined cards yet"}
              </div>
            ) : (
              displayedResults.map((result) => (
                <motion.div
                  key={result.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700/50 p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${
                          result.status === 'live' ? 'bg-emerald-500' : 'bg-rose-500'
                        }`} />
                        <p className="font-mono text-xs truncate text-slate-700 dark:text-slate-300">
                          {result.card}
                        </p>
                      </div>
                      <p className={`text-xs font-medium ${
                        result.status === 'live' ? 'text-emerald-600' : 'text-rose-500'
                      }`}>
                        {result.status === 'live' ? 'APPROVED' : 'DECLINED'}
                      </p>
                      {result.message && (
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{result.message}</p>
                      )}
                    </div>
                    <button
                      onClick={() => copyCard(result.card)}
                      className="p-2 rounded-lg hover-elevate"
                    >
                      <Copy className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-700/50 px-4 py-2 z-50">
        <div className="flex items-center justify-around max-w-md mx-auto">
          <Link href="/">
            <button className="flex flex-col items-center gap-1 py-2 px-6 text-rose-500">
              <HomeIcon className="w-5 h-5" />
              <span className="text-[10px] font-medium">Home</span>
            </button>
          </Link>
          <button className="flex flex-col items-center gap-1 py-2 px-6 text-slate-400">
            <User className="w-5 h-5" />
            <span className="text-[10px] font-medium">Profile</span>
          </button>
          <Link href="/settings">
            <button className="flex flex-col items-center gap-1 py-2 px-6 text-slate-400">
              <Settings className="w-5 h-5" />
              <span className="text-[10px] font-medium">Settings</span>
            </button>
          </Link>
        </div>
      </nav>

    </div>
  );
}
