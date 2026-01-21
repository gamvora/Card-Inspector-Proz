import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSettings, useUpdateSettings, useStartCheck, useStopCheck, useClearResults, useCheckerSocket } from "@/hooks/use-checker";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ResultsFeed } from "@/components/ResultsFeed";
import { StatusPanel } from "@/components/StatusPanel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Play, 
  Square, 
  Trash2, 
  Settings2, 
  ShieldCheck, 
  CreditCard, 
  Copy, 
  CheckCheck,
  Globe,
  Coins,
  TrendingUp,
  TrendingDown,
  Filter,
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
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const startCheck = useStartCheck();
  const stopCheck = useStopCheck();
  const clearRemoteResults = useClearResults();
  const { results, stats, logs, clearLocalResults } = useCheckerSocket();
  const { toast } = useToast();

  const [cardsInput, setCardsInput] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [copiedAll, setCopiedAll] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "live" | "dead">("all");

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
    if (sites.length > 0 && !selectedSiteId) {
      const active = sites.find(s => s.isActive);
      if (active) {
        setSelectedSiteId(active.id.toString());
      } else if (sites[0]) {
        setSelectedSiteId(sites[0].id.toString());
      }
    }
  }, [sites, selectedSiteId]);

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
    startCheck.mutate({ cards, siteId: selectedSiteId ? parseInt(selectedSiteId) : undefined });
  };

  const handleStop = () => {
    stopCheck.mutate();
  };

  const handleClear = () => {
    clearRemoteResults.mutate();
    clearLocalResults();
    toast({
      title: "Cleared",
      description: "Results cleared.",
    });
  };

  const filteredResults = results.filter(r => {
    if (filterType === "all") return true;
    return r.status === filterType;
  });

  const liveResults = results.filter(r => r.status === 'live');
  const deadResults = results.filter(r => r.status === 'dead');

  const copyCard = (card: string) => {
    navigator.clipboard.writeText(card);
    toast({ title: "Card copied" });
  };

  const copyAllCards = (type: "live" | "dead") => {
    const cards = type === "live" ? liveResults : deadResults;
    const text = cards.map(r => r.card).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
    toast({ title: `Copied ${cards.length} ${type} cards` });
  };

  const selectedSite = sites.find(s => s.id.toString() === selectedSiteId);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30 relative">
      <div className="scanlines" />
      
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-md sticky top-0 z-40">
        <div className="container mx-auto px-3 md:px-4 h-14 md:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 md:w-6 md:h-6 text-primary animate-pulse" />
            <h1 className="text-sm md:text-xl font-orbitron font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60 tracking-widest">
              NEXUS<span className="text-primary">CHECKER</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            <div className="flex items-center gap-1.5 bg-primary/10 px-2 py-1 md:px-3 md:py-1.5 rounded-lg border border-primary/30">
              <Coins className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary" />
              <span className="font-mono text-xs md:text-sm font-bold text-primary" data-testid="credits-balance">
                {user?.credits || 0}
              </span>
            </div>
            
            <Link href="/settings">
              <Button variant="ghost" size="icon" className="w-8 h-8 md:w-9 md:h-9" data-testid="button-settings">
                <Settings2 className="w-4 h-4 md:w-5 md:h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 md:px-4 py-3 md:py-6 relative z-10">
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-4 md:mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card p-3 md:p-4 rounded-xl border border-border/50 flex items-center gap-3"
          >
            <div className="p-2 rounded-lg bg-primary/10">
              <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] md:text-xs text-muted-foreground uppercase">Total Charged</p>
              <p className="text-lg md:text-xl font-bold font-mono text-primary" data-testid="stat-total-charged">
                {userStats?.totalCharged || 0}
              </p>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card p-3 md:p-4 rounded-xl border border-border/50 flex items-center gap-3"
          >
            <div className="p-2 rounded-lg bg-destructive/10">
              <TrendingDown className="w-4 h-4 md:w-5 md:h-5 text-destructive" />
            </div>
            <div>
              <p className="text-[10px] md:text-xs text-muted-foreground uppercase">Total Rejected</p>
              <p className="text-lg md:text-xl font-bold font-mono text-destructive" data-testid="stat-total-rejected">
                {userStats?.totalRejected || 0}
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card p-3 md:p-4 rounded-xl border border-border/50 flex items-center gap-3"
          >
            <div className="p-2 rounded-lg bg-green-500/10">
              <CheckCheck className="w-4 h-4 md:w-5 md:h-5 text-green-500" />
            </div>
            <div>
              <p className="text-[10px] md:text-xs text-muted-foreground uppercase">Session Live</p>
              <p className="text-lg md:text-xl font-bold font-mono text-green-500" data-testid="stat-session-live">
                {liveResults.length}
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card p-3 md:p-4 rounded-xl border border-border/50 flex items-center gap-3"
          >
            <div className="p-2 rounded-lg bg-red-500/10">
              <CreditCard className="w-4 h-4 md:w-5 md:h-5 text-red-500" />
            </div>
            <div>
              <p className="text-[10px] md:text-xs text-muted-foreground uppercase">Session Dead</p>
              <p className="text-lg md:text-xl font-bold font-mono text-red-500" data-testid="stat-session-dead">
                {deadResults.length}
              </p>
            </div>
          </motion.div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 md:gap-4 mb-4 md:mb-6">
          <div className="flex-1">
            <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
              <SelectTrigger className="bg-card border-border/50" data-testid="select-site">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary" />
                  <SelectValue placeholder="Select a site" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {sites.length === 0 ? (
                  <SelectItem value="none" disabled>No sites configured</SelectItem>
                ) : (
                  sites.map((site) => (
                    <SelectItem key={site.id} value={site.id.toString()}>
                      {site.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          
          {selectedSite && (
            <Badge variant="outline" className="text-xs px-3 py-2 truncate max-w-[200px]">
              {selectedSite.url}
            </Badge>
          )}
        </div>

        <StatusPanel 
          active={stats.active} 
          processed={stats.processed} 
          total={stats.total} 
          logs={logs} 
        />

        <div className="flex flex-wrap gap-2 md:gap-4 mb-4 md:mb-6">
          <Button 
            onClick={handleStart}
            disabled={stats.active || startCheck.isPending || sites.length === 0}
            className={`
              font-orbitron tracking-wider flex-1 min-w-[120px] text-xs md:text-sm
              ${stats.active ? 'opacity-50' : 'bg-primary hover:bg-primary/90 text-black shadow-[0_0_20px_rgba(34,197,94,0.3)]'}
            `}
            data-testid="button-start"
          >
            <Play className="w-4 h-4 md:w-5 md:h-5 mr-1.5 md:mr-2 fill-current" />
            START
          </Button>

          <Button 
            onClick={handleStop}
            disabled={!stats.active || stopCheck.isPending}
            variant="destructive"
            className="font-orbitron tracking-wider flex-1 min-w-[100px] text-xs md:text-sm shadow-[0_0_20px_rgba(239,68,68,0.3)]"
            data-testid="button-stop"
          >
            <Square className="w-4 h-4 md:w-5 md:h-5 mr-1.5 md:mr-2 fill-current" />
            STOP
          </Button>

          <Button 
            onClick={handleClear}
            variant="secondary"
            size="sm"
            className="font-orbitron tracking-wider bg-white/5 hover:bg-white/10 border border-white/10 text-xs md:text-sm"
            data-testid="button-clear"
          >
            <Trash2 className="w-4 h-4 md:w-5 md:h-5 mr-1 md:mr-2" />
            <span className="hidden sm:inline">CLEAR</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 md:gap-6 min-h-[400px] lg:h-[500px]">
          
          <div className="lg:col-span-3 flex flex-col h-[200px] md:h-[250px] lg:h-full bg-card rounded-xl border border-border/50 overflow-hidden shadow-lg">
            <div className="p-3 md:p-4 bg-muted/20 border-b border-border/50">
              <h3 className="font-orbitron text-xs md:text-sm tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                INPUT DATA
              </h3>
            </div>
            <div className="flex-1 p-2 relative">
              <Textarea 
                value={cardsInput}
                onChange={(e) => setCardsInput(e.target.value)}
                placeholder="Paste cards here...&#10;CC|MM|YY|CVV"
                className="w-full h-full resize-none bg-transparent border-0 focus-visible:ring-0 font-mono text-xs md:text-sm p-3 md:p-4 leading-relaxed custom-scrollbar"
                spellCheck={false}
                data-testid="input-cards"
              />
              <div className="absolute bottom-3 right-3 text-[10px] md:text-xs font-mono text-muted-foreground bg-background/80 px-2 py-1 rounded border border-border/50">
                {cardsInput.split('\n').filter(l => l.trim().length > 0).length} CARDS
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 h-[250px] md:h-[300px] lg:h-full">
            <div className="h-full bg-card rounded-xl border border-primary/30 overflow-hidden shadow-lg flex flex-col">
              <div className="p-3 md:p-4 bg-primary/10 border-b border-primary/30 flex items-center justify-between">
                <h3 className="font-orbitron text-xs md:text-sm tracking-wider flex items-center gap-2 text-primary">
                  <CheckCheck className="w-4 h-4" />
                  APPROVED ({liveResults.length})
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyAllCards("live")}
                  disabled={liveResults.length === 0}
                  className="h-7 px-2 text-xs"
                  data-testid="button-copy-all-live"
                >
                  {copiedAll ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                <AnimatePresence>
                  {liveResults.map((result) => (
                    <motion.div
                      key={result.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="group p-2 rounded bg-primary/5 hover:bg-primary/10 border border-primary/20 flex items-center justify-between"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-xs truncate text-primary">{result.card}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{result.message}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyCard(result.card)}
                        className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {liveResults.length === 0 && (
                  <p className="text-center text-muted-foreground text-xs py-8">No approved cards yet</p>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 h-[250px] md:h-[300px] lg:h-full">
            <div className="h-full bg-card rounded-xl border border-destructive/30 overflow-hidden shadow-lg flex flex-col">
              <div className="p-3 md:p-4 bg-destructive/10 border-b border-destructive/30 flex items-center justify-between">
                <h3 className="font-orbitron text-xs md:text-sm tracking-wider flex items-center gap-2 text-destructive">
                  <CreditCard className="w-4 h-4" />
                  REJECTED ({deadResults.length})
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyAllCards("dead")}
                  disabled={deadResults.length === 0}
                  className="h-7 px-2 text-xs"
                  data-testid="button-copy-all-dead"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                <AnimatePresence>
                  {deadResults.map((result) => (
                    <motion.div
                      key={result.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="group p-2 rounded bg-destructive/5 hover:bg-destructive/10 border border-destructive/20 flex items-center justify-between"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-xs truncate text-destructive/80">{result.card}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{result.message}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyCard(result.card)}
                        className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {deadResults.length === 0 && (
                  <p className="text-center text-muted-foreground text-xs py-8">No rejected cards yet</p>
                )}
              </div>
            </div>
          </div>

        </div>

        {user && (
          <div className="mt-6 p-4 bg-card rounded-xl border border-border/50">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-lg font-bold text-primary">
                    {user.firstName?.[0] || user.username?.[0] || 'U'}
                  </span>
                </div>
                <div>
                  <p className="font-medium">{user.firstName} {user.lastName}</p>
                  <p className="text-xs text-muted-foreground">@{user.username || user.telegramId}</p>
                </div>
              </div>
              
              {user.isAdmin && (
                <Badge className="bg-primary/20 text-primary border-primary/30">
                  Admin
                </Badge>
              )}
            </div>
          </div>
        )}
      </main>
      
      <footer className="mt-8 py-4 text-center text-xs font-mono text-muted-foreground border-t border-border/30 bg-black/40">
        <p>SECURE CARD TESTING ENVIRONMENT // AUTHORIZED ACCESS ONLY</p>
      </footer>
    </div>
  );
}
