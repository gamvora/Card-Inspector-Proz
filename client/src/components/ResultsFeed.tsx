import { CheckResult } from "@shared/schema";
import { CyberCard } from "@/components/ui/cyber-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface ResultsFeedProps {
  title: string;
  results: CheckResult[];
  type: "live" | "dead";
}

export function ResultsFeed({ title, results, type }: ResultsFeedProps) {
  const isLive = type === "live";
  const filteredResults = results.filter(r => 
    isLive ? r.status === "live" : r.status !== "live"
  );

  return (
    <div className="flex flex-col h-full bg-black/40 border border-border/30 rounded-lg overflow-hidden backdrop-blur-sm">
      <div className={`p-2 md:p-4 border-b border-border/30 flex justify-between items-center gap-2 ${isLive ? 'bg-primary/10' : 'bg-destructive/10'}`}>
        <h3 className={`font-orbitron font-bold text-sm md:text-lg tracking-wider flex items-center gap-1.5 md:gap-2 ${isLive ? 'text-primary' : 'text-destructive'}`}>
          {isLive ? <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5" /> : <XCircle className="w-4 h-4 md:w-5 md:h-5" />}
          {title}
        </h3>
        <Badge 
          variant={isLive ? "default" : "destructive"} 
          className="font-mono text-[10px] md:text-xs"
          data-testid={isLive ? "count-live" : "count-rejected"}
        >
          {filteredResults.length}
        </Badge>
      </div>
      
      <ScrollArea className="flex-1 p-2 md:p-4">
        <div className="space-y-2 md:space-y-3">
          <AnimatePresence initial={false}>
            {filteredResults.map((result) => (
              <motion.div
                key={result.id}
                initial={{ opacity: 0, x: isLive ? -20 : 20, height: 0 }}
                animate={{ opacity: 1, x: 0, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                data-testid={`result-${result.id}`}
              >
                <CyberCard 
                  variant={isLive ? "success" : "danger"} 
                  className="p-2 md:p-3 border-l-4 overflow-hidden relative group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1s_infinite] pointer-events-none" />
                  
                  <div className="flex justify-between items-start gap-2 md:gap-4 relative z-10">
                    <div className="font-mono text-[10px] md:text-sm break-all font-bold tracking-tight">
                      {result.card}
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`uppercase text-[8px] md:text-[10px] px-1 md:px-1.5 h-4 md:h-5 shrink-0 ${isLive ? 'border-primary text-primary' : 'border-destructive text-destructive'}`}
                    >
                      {result.status}
                    </Badge>
                  </div>
                  
                  {result.message && (
                    <div className="mt-1.5 md:mt-2 text-[9px] md:text-xs font-mono opacity-70 border-t border-border/20 pt-1.5 md:pt-2 flex items-start gap-1 md:gap-1.5">
                       <span className="shrink-0 mt-0.5">↳</span>
                       <span className="break-words">{result.message}</span>
                    </div>
                  )}
                </CyberCard>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {filteredResults.length === 0 && (
            <div className="h-24 md:h-32 flex flex-col items-center justify-center text-muted-foreground opacity-30">
              <AlertCircle className="w-6 h-6 md:w-8 md:h-8 mb-2" />
              <p className="font-mono text-[10px] md:text-xs uppercase">No Data</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
