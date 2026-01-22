import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useStartCheck, useStopCheck } from "@/hooks/use-checker";
import { useCheckerContext } from "@/lib/checker-context";
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
  MessageCircle,
  FileUp,
  Eraser,
  Globe,
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
  const { results, stats, clearLocalResults, fetchCheckStatus } = useCheckerContext();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cardsInput, setCardsInput] = useState("");
  const [selectedSiteIndex, setSelectedSiteIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<"live" | "dead">("live");
  const [lastChargedCount, setLastChargedCount] = useState(0);
  const prevResultsRef = useRef<CheckResult[]>([]);
  const notifiedCardsRef = useRef<Set<number>>(new Set());
  const [isFocused, setIsFocused] = useState(false);

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
    fetchCheckStatus();
  }, [fetchCheckStatus]);

  useEffect(() => {
    if (stats.charged !== undefined || stats.rejected !== undefined) {
      refreshUser();
    }
  }, [stats.charged, stats.rejected]);

  useEffect(() => {
    const liveResults = results.filter(r => r.status === 'live');
    
    liveResults.forEach((card) => {
      if (!notifiedCardsRef.current.has(card.id)) {
        notifiedCardsRef.current.add(card.id);
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
      }
    });
    
    prevResultsRef.current = results;
  }, [results, toast]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.txt')) {
      toast({
        title: "Invalid File",
        description: "Please upload a .txt file",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCardsInput(prev => prev ? prev + '\n' + content : content);
      toast({
        title: "File Loaded",
        description: `${content.split('\n').filter(l => l.trim()).length} cards imported`,
        soundType: 'default',
      });
    };
    reader.readAsText(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const cleanCards = () => {
    const lines = cardsInput.split('\n').map(l => l.trim()).filter(l => l);
    const validCards: string[] = [];
    const seen = new Set<string>();
    let removedDuplicates = 0;
    let removedExpired = 0;
    let removedInvalid = 0;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    for (const line of lines) {
      const parts = line.split('|');
      if (parts.length < 4) {
        removedInvalid++;
        continue;
      }

      const [cardNum, expMonth, expYear, cvv] = parts;
      
      // Check card number (13-19 digits)
      const cleanCardNum = cardNum.replace(/\s/g, '');
      if (!/^\d{13,19}$/.test(cleanCardNum)) {
        removedInvalid++;
        continue;
      }

      // Check expiry
      const month = parseInt(expMonth);
      let year = parseInt(expYear);
      if (year < 100) year += 2000;
      
      if (isNaN(month) || month < 1 || month > 12) {
        removedInvalid++;
        continue;
      }

      if (year < currentYear || (year === currentYear && month < currentMonth)) {
        removedExpired++;
        continue;
      }

      // Check CVV (3-4 digits)
      if (!/^\d{3,4}$/.test(cvv)) {
        removedInvalid++;
        continue;
      }

      // Check duplicates
      const cardKey = cleanCardNum;
      if (seen.has(cardKey)) {
        removedDuplicates++;
        continue;
      }
      seen.add(cardKey);
      validCards.push(line);
    }

    setCardsInput(validCards.join('\n'));
    
    const total = removedDuplicates + removedExpired + removedInvalid;
    if (total > 0) {
      toast({
        title: "Cards Cleaned",
        description: `Removed: ${removedDuplicates} duplicates, ${removedExpired} expired, ${removedInvalid} invalid`,
        soundType: 'success',
      });
    } else {
      toast({
        title: "All cards are valid",
        description: `${validCards.length} cards ready to check`,
      });
    }
  };

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
    notifiedCardsRef.current.clear();
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

  const openOwnerChat = () => {
    window.open('https://t.me/lucee7', '_blank');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".txt"
        className="hidden"
      />
      
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
          
          <div className="flex items-center gap-3">
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
            
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={openOwnerChat}
              className="p-2 rounded-full bg-blue-500/10 border border-blue-500/20"
              data-testid="button-contact-owner"
            >
              <MessageCircle className="w-4 h-4 text-blue-500" />
            </motion.button>
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
              <Sparkles className="w-5 h-5 text-purple-400" />
            </motion.div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 dark:from-purple-400 dark:via-pink-400 dark:to-rose-400 bg-clip-text text-transparent">
              NexusChecker
            </h1>
            <motion.div
              animate={{ rotate: [0, -15, 15, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              <Sparkles className="w-5 h-5 text-rose-400" />
            </motion.div>
          </div>
          <motion.button
            onClick={openOwnerChat}
            whileHover={{ scale: 1.05 }}
            className="text-xs text-blue-500 mt-1 flex items-center gap-1 mx-auto"
          >
            <span>@lucee7</span>
          </motion.button>
        </motion.div>
      </header>

      <main className="flex-1 px-4 space-y-4">
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`relative rounded-2xl overflow-hidden ${
            isFocused ? 'neon-border-active' : ''
          }`}
          style={{
            background: isFocused 
              ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.05), rgba(59, 130, 246, 0.05))'
              : undefined
          }}
        >
          <div className={`absolute inset-0 rounded-2xl transition-opacity duration-500 ${
            isFocused ? 'opacity-100' : 'opacity-0'
          }`} style={{
            background: 'linear-gradient(90deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3, #ff0000)',
            backgroundSize: '400% 100%',
            animation: isFocused ? 'rainbowBorder 4s linear infinite' : 'none',
            padding: '2px',
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            filter: 'brightness(1.2) saturate(1.3)',
          }} />
          
          <div className="bg-card rounded-2xl border border-border shadow-lg overflow-hidden relative">
            <Textarea 
              value={cardsInput}
              onChange={(e) => setCardsInput(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Paste your cards here...&#10;Format: 4111111111111111|12|2025|123"
              className="border-0 min-h-[140px] resize-none bg-transparent focus-visible:ring-0 font-mono text-sm p-4 leading-relaxed placeholder:text-muted-foreground/50"
              spellCheck={false}
              data-testid="input-cards"
            />
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <motion.button 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 transition-colors"
                  data-testid="button-upload-file"
                >
                  <FileUp className="w-4 h-4 text-purple-500" />
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={cleanCards}
                  disabled={!cardsInput.trim()}
                  className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                  data-testid="button-clean-cards"
                >
                  <Eraser className="w-4 h-4 text-amber-500" />
                </motion.button>
              </div>
              <motion.div 
                key={cardsInput.split('\n').filter(l => l.trim().length > 0).length}
                initial={{ scale: 1.1 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-2 text-xs font-mono px-3 py-1.5 bg-muted rounded-lg text-muted-foreground"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>{cardsInput.split('\n').filter(l => l.trim().length > 0).length} cards</span>
              </motion.div>
              <Link href="/settings">
                <motion.button 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2.5 rounded-xl hover:bg-muted transition-colors"
                >
                  <Settings className="w-4 h-4 text-muted-foreground" />
                </motion.button>
              </Link>
            </div>
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
            className="rounded-full h-10 w-10 border border-border"
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
                  <div className="text-center text-sm text-muted-foreground py-2.5 px-4 bg-muted rounded-xl cursor-pointer border-2 border-dashed border-border">
                    + Add Site
                  </div>
                </Link>
              ) : (
                <div className="text-center py-2.5 px-4 bg-card rounded-xl border border-border">
                  <div className="flex items-center justify-center gap-2">
                    <CreditCard className="w-4 h-4 text-purple-500" />
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
            className="rounded-full h-10 w-10 border border-border"
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
            className="flex-1 h-12 rounded-xl font-semibold text-base bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg shadow-purple-500/20 border-0"
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
                Start Check
              </>
            )}
          </Button>

          <Button 
            onClick={handleStop}
            disabled={!stats.active || stopCheck.isPending}
            variant="outline"
            className="h-12 px-6 rounded-xl font-semibold border-2"
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
            className="text-center text-sm text-muted-foreground"
          >
            <span className="font-mono">{stats.processed}</span>
            <span className="opacity-50"> / </span>
            <span className="font-mono">{stats.total}</span>
            <span className="opacity-50 ml-2">processed</span>
          </motion.div>
        )}

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="flex gap-2 p-1.5 bg-muted rounded-2xl"
        >
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab("live")}
            className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              activeTab === "live"
                ? "bg-card text-emerald-600 dark:text-emerald-400 shadow-md"
                : "text-muted-foreground"
            }`}
            data-testid="tab-live"
          >
            <CheckCircle2 className="w-4 h-4" />
            LIVE ({liveResults.length})
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab("dead")}
            className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              activeTab === "dead"
                ? "bg-card text-rose-600 dark:text-rose-400 shadow-md"
                : "text-muted-foreground"
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
                <p className="text-muted-foreground text-sm">
                  {activeTab === "live" ? "No live cards yet" : "No declined cards yet"}
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
                      <div className="flex items-center gap-2 mb-1">
                        <motion.span 
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className={`w-3 h-3 rounded-full ${
                            result.status === 'live' ? 'bg-emerald-500' : 'bg-rose-500'
                          }`} 
                        />
                        <p className="font-mono text-xs font-medium truncate">
                          {result.card}
                        </p>
                      </div>
                      {selectedSite && (
                        <div className="flex items-center gap-1.5 mb-2 ml-5">
                          <Globe className="w-3 h-3 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground font-medium truncate">
                            {selectedSite.name}
                          </span>
                        </div>
                      )}
                      <p className={`text-sm font-bold ${
                        result.status === 'live' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}>
                        {result.status === 'live' ? 'LIVE' : (result.message || 'DECLINED')}
                      </p>
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

      <nav className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-xl border-t border-border px-4 py-3 z-50">
        <div className="flex items-center justify-around max-w-md mx-auto">
          <Link href="/">
            <motion.button 
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-1.5 py-1 px-8"
              data-testid="nav-home"
            >
              <div className="p-2 rounded-xl bg-purple-500/10">
                <HomeIcon className="w-5 h-5 text-purple-500" />
              </div>
              <span className="text-[10px] font-semibold text-purple-500">Home</span>
            </motion.button>
          </Link>
          <Link href="/profile">
            <motion.button 
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-1.5 py-1 px-8"
              data-testid="nav-profile"
            >
              <div className="p-2">
                <User className="w-5 h-5 text-muted-foreground" />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground">Profile</span>
            </motion.button>
          </Link>
          <Link href="/settings">
            <motion.button 
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-1.5 py-1 px-8"
              data-testid="nav-settings"
            >
              <div className="p-2">
                <Settings className="w-5 h-5 text-muted-foreground" />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground">Settings</span>
            </motion.button>
          </Link>
        </div>
      </nav>

    </div>
  );
}
