import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useStartCheck, useStopCheck, useClearResults, useCheckerSocket } from "@/hooks/use-checker";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { 
  Play, 
  Square, 
  Settings2, 
  CreditCard, 
  Copy, 
  CheckCheck,
  Coins,
  ChevronLeft,
  ChevronRight,
  Zap,
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
  const clearRemoteResults = useClearResults();
  const { results, stats, clearLocalResults } = useCheckerSocket();
  const { toast } = useToast();

  const [cardsInput, setCardsInput] = useState("");
  const [selectedSiteIndex, setSelectedSiteIndex] = useState(0);
  const [copiedAll, setCopiedAll] = useState(false);

  const { data: sites = [] } = useQuery<Site[]>({
    queryKey: ['/api/sites'],
    queryFn: async () => {
      const res = await authFetch('/api/sites');
      if (!res.ok) return [];
      return res.json();
    },
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

  const copyAllCards = (type: "live" | "dead") => {
    const cards = type === "live" ? liveResults : deadResults;
    const text = cards.map(r => r.card).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
    toast({ title: `Copied ${cards.length} cards` });
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

  const progress = stats.total > 0 ? (stats.processed / stats.total) * 100 : 0;
  const cardCount = cardsInput.split('\n').filter(l => l.trim().length > 0).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/95 flex flex-col">
      
      <header className="border-b border-border/30 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">NexusCC</span>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">
              <Coins className="w-4 h-4 text-primary" />
              <span className="font-mono text-sm font-semibold text-primary" data-testid="credits-balance">
                {user?.credits || 0}
              </span>
            </div>
            
            <Link href="/settings">
              <Button variant="ghost" size="icon" className="rounded-full" data-testid="button-settings">
                <Settings2 className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 space-y-4 max-w-lg mx-auto w-full">
        
        <div className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-xl">
          <div className="p-4 border-b border-border/30 bg-muted/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Card Input</span>
              <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {cardCount} cards
              </span>
            </div>
          </div>
          <Textarea 
            value={cardsInput}
            onChange={(e) => setCardsInput(e.target.value)}
            placeholder="Paste cards here...&#10;4111111111111111|12|25|123"
            className="border-0 rounded-none min-h-[140px] resize-none bg-transparent focus-visible:ring-0 font-mono text-sm p-4 leading-relaxed"
            spellCheck={false}
            data-testid="input-cards"
          />
        </div>

        <div className="flex items-center justify-center gap-3 py-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={prevSite}
            disabled={sites.length <= 1}
            className="rounded-full w-10 h-10"
            data-testid="button-prev-site"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          
          <div className="flex-1 text-center min-w-0">
            {sites.length === 0 ? (
              <Link href="/settings">
                <div className="text-muted-foreground text-sm py-2 px-4 bg-muted/50 rounded-xl cursor-pointer hover:bg-muted transition-colors">
                  + Add a site in Settings
                </div>
              </Link>
            ) : (
              <div className="py-2 px-4 bg-primary/5 border border-primary/20 rounded-xl">
                <p className="font-medium text-sm truncate" data-testid="selected-site-name">
                  {selectedSite?.name || 'No site'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {sites.length > 1 ? `${selectedSiteIndex + 1} of ${sites.length}` : 'Active site'}
                </p>
              </div>
            )}
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={nextSite}
            disabled={sites.length <= 1}
            className="rounded-full w-10 h-10"
            data-testid="button-next-site"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex gap-3">
          <Button 
            onClick={handleStart}
            disabled={stats.active || startCheck.isPending || sites.length === 0}
            className="flex-1 h-12 rounded-xl font-semibold text-base shadow-lg shadow-primary/20"
            data-testid="button-start"
          >
            <Play className="w-5 h-5 mr-2 fill-current" />
            START
          </Button>

          <Button 
            onClick={handleStop}
            disabled={!stats.active || stopCheck.isPending}
            variant="destructive"
            className="flex-1 h-12 rounded-xl font-semibold text-base shadow-lg"
            data-testid="button-stop"
          >
            <Square className="w-5 h-5 mr-2 fill-current" />
            STOP
          </Button>
        </div>

        {stats.active && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl border border-primary/30 p-4"
          >
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Processing...</span>
              <span className="font-mono text-primary">{stats.processed}/{stats.total}</span>
            </div>
            <Progress value={progress} className="h-2" />
          </motion.div>
        )}

        <div className="space-y-3">
          <div className="bg-card rounded-2xl border border-green-500/30 overflow-hidden">
            <div className="p-3 bg-green-500/10 border-b border-green-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCheck className="w-4 h-4 text-green-500" />
                <span className="font-semibold text-sm text-green-500">Approved</span>
                <span className="text-xs bg-green-500/20 px-2 py-0.5 rounded-full text-green-500 font-mono">
                  {liveResults.length}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyAllCards("live")}
                disabled={liveResults.length === 0}
                className="h-7 px-2 text-xs text-green-500 hover:text-green-400"
                data-testid="button-copy-all-live"
              >
                <Copy className="w-3 h-3 mr-1" />
                Copy All
              </Button>
            </div>
            <div className="max-h-[200px] overflow-y-auto">
              <AnimatePresence>
                {liveResults.length === 0 ? (
                  <p className="text-center text-muted-foreground text-xs py-6">No approved cards yet</p>
                ) : (
                  liveResults.map((result) => (
                    <motion.div
                      key={result.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="group px-3 py-2 border-b border-border/30 last:border-0 flex items-center justify-between hover:bg-green-500/5"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-xs truncate text-green-400">{result.card}</p>
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
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-red-500/30 overflow-hidden">
            <div className="p-3 bg-red-500/10 border-b border-red-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-red-500" />
                <span className="font-semibold text-sm text-red-500">Declined</span>
                <span className="text-xs bg-red-500/20 px-2 py-0.5 rounded-full text-red-500 font-mono">
                  {deadResults.length}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyAllCards("dead")}
                disabled={deadResults.length === 0}
                className="h-7 px-2 text-xs text-red-500 hover:text-red-400"
                data-testid="button-copy-all-dead"
              >
                <Copy className="w-3 h-3 mr-1" />
                Copy All
              </Button>
            </div>
            <div className="max-h-[200px] overflow-y-auto">
              <AnimatePresence>
                {deadResults.length === 0 ? (
                  <p className="text-center text-muted-foreground text-xs py-6">No declined cards yet</p>
                ) : (
                  deadResults.map((result) => (
                    <motion.div
                      key={result.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="group px-3 py-2 border-b border-border/30 last:border-0 flex items-center justify-between hover:bg-red-500/5"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-xs truncate text-red-400/80">{result.card}</p>
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
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
