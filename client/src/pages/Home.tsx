import { useEffect, useState } from "react";
import { useSettings, useUpdateSettings, useStartCheck, useStopCheck, useClearResults, useCheckerSocket } from "@/hooks/use-checker";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResultsFeed } from "@/components/ResultsFeed";
import { StatusPanel } from "@/components/StatusPanel";
import { Play, Square, Trash2, Save, Settings2, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  // Data & Actions
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const startCheck = useStartCheck();
  const stopCheck = useStopCheck();
  const clearRemoteResults = useClearResults();
  const { results, stats, logs, clearLocalResults } = useCheckerSocket();
  const { toast } = useToast();

  // Local Form State
  const [targetUrl, setTargetUrl] = useState("");
  const [proxyList, setProxyList] = useState("");
  const [cardsInput, setCardsInput] = useState("");

  // Sync settings when loaded
  useEffect(() => {
    if (settings) {
      setTargetUrl(settings.targetUrl || "");
      setProxyList(settings.proxyList || "");
    }
  }, [settings]);

  // Handlers
  const handleSaveSettings = () => {
    updateSettings.mutate({ 
      targetUrl, 
      proxyList,
      proxyEnabled: true 
    });
  };

  const handleStart = () => {
    if (!cardsInput.trim()) {
      toast({
        title: "Input Required",
        description: "Please enter cards to check.",
        variant: "destructive",
      });
      return;
    }
    
    // Split by newlines, filter empty
    const cards = cardsInput.split('\n').map(c => c.trim()).filter(c => c.length > 0);
    
    if (cards.length === 0) return;
    
    // Clear local results before starting new check
    clearLocalResults();
    startCheck.mutate(cards);
  };

  const handleStop = () => {
    stopCheck.mutate();
  };

  const handleClear = () => {
    clearRemoteResults.mutate();
    clearLocalResults();
    toast({
      title: "Memory Purged",
      description: "Local and remote result history cleared.",
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30 relative">
      <div className="scanlines" />
      
      {/* Header */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-md sticky top-0 z-40">
        <div className="container mx-auto px-3 md:px-4 h-12 md:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 md:w-6 md:h-6 text-primary animate-pulse" />
            <h1 className="text-base md:text-xl font-orbitron font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60 tracking-widest">
              NEXUS<span className="text-primary">CHECKER</span>
            </h1>
          </div>
          <div className="text-[10px] md:text-xs font-mono text-muted-foreground">
            V.2.0.4
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 md:px-4 py-4 md:py-6 relative z-10">
        
        {/* Settings Bar */}
        <section className="mb-4 md:mb-8 p-4 md:p-6 rounded-xl bg-card border border-border/50 shadow-lg shadow-black/20">
          <div className="flex items-center gap-2 mb-3 md:mb-4 text-primary">
            <Settings2 className="w-4 h-4 md:w-5 md:h-5" />
            <h2 className="font-orbitron text-xs md:text-sm tracking-widest">CONFIGURATION</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="space-y-2">
              <Label className="text-[10px] md:text-xs uppercase tracking-wider font-mono text-muted-foreground">Target Endpoint</Label>
              <div className="relative group">
                <Input 
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="https://example.com/checkout"
                  className="font-mono text-xs md:text-sm bg-black/50 border-white/10 focus:border-primary/50 transition-all pl-3"
                  data-testid="input-target-url"
                />
                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity rounded-md" />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-[10px] md:text-xs uppercase tracking-wider font-mono text-muted-foreground">Proxy List (Rotating)</Label>
              <Textarea 
                value={proxyList}
                onChange={(e) => setProxyList(e.target.value)}
                placeholder="ip:port:user:pass"
                className="font-mono bg-black/50 border-white/10 focus:border-primary/50 min-h-[60px] md:min-h-[80px] text-xs resize-none"
                data-testid="input-proxy"
              />
            </div>
          </div>

          <div className="mt-3 md:mt-4 flex justify-end">
            <Button 
              onClick={handleSaveSettings}
              disabled={updateSettings.isPending}
              variant="outline"
              size="sm"
              className="border-primary/30 hover:bg-primary/10 hover:border-primary text-primary font-mono text-[10px] md:text-xs uppercase"
              data-testid="button-save-settings"
            >
              <Save className="w-3 h-3 md:w-4 md:h-4 mr-1.5 md:mr-2" />
              {updateSettings.isPending ? "Saving..." : "Save Configuration"}
            </Button>
          </div>
        </section>

        <StatusPanel 
          active={stats.active} 
          processed={stats.processed} 
          total={stats.total} 
          logs={logs} 
        />

        {/* Action Bar */}
        <div className="flex flex-wrap gap-2 md:gap-4 mb-4 md:mb-6">
          <Button 
            onClick={handleStart}
            disabled={stats.active || startCheck.isPending}
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

        {/* Main Workspace */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 md:gap-6 min-h-[400px] lg:h-[600px]">
          
          {/* Input Column */}
          <div className="md:col-span-2 lg:col-span-3 flex flex-col h-[250px] md:h-[300px] lg:h-full bg-card rounded-xl border border-border/50 overflow-hidden shadow-lg">
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

          {/* Results Column - LIVE */}
          <div className="md:col-span-1 lg:col-span-5 h-[300px] md:h-[350px] lg:h-full">
            <ResultsFeed title="APPROVED" type="live" results={results} />
          </div>

          {/* Results Column - DEAD */}
          <div className="md:col-span-1 lg:col-span-4 h-[300px] md:h-[350px] lg:h-full">
            <ResultsFeed title="REJECTED" type="dead" results={results} />
          </div>

        </div>
      </main>
      
      {/* Footer */}
      <footer className="mt-12 py-6 text-center text-xs font-mono text-muted-foreground border-t border-border/30 bg-black/40">
        <p>SECURE CARD TESTING ENVIRONMENT // AUTHORIZED ACCESS ONLY</p>
      </footer>
    </div>
  );
}
