import { motion } from "framer-motion";
import { Terminal, Activity, Wifi } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface StatusPanelProps {
  active: boolean;
  processed: number;
  total: number;
  logs: { message: string; type: string }[];
}

export function StatusPanel({ active, processed, total, logs }: StatusPanelProps) {
  const progress = total > 0 ? (processed / total) * 100 : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6">
      {/* Stats Card */}
      <div className="md:col-span-1 bg-black/60 border border-primary/20 rounded-lg p-3 md:p-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-2 opacity-30 md:opacity-50">
          <Activity className={`w-8 h-8 md:w-12 md:h-12 ${active ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
        </div>
        
        <h3 className="font-orbitron text-xs md:text-sm text-primary mb-3 md:mb-4 tracking-widest">SYSTEM STATUS</h3>
        
        <div className="space-y-3 md:space-y-4 relative z-10">
          <div>
            <div className="flex justify-between text-[10px] md:text-xs font-mono mb-1 text-muted-foreground gap-2">
              <span>PROGRESS</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-1.5 md:h-2 bg-primary/10 border border-primary/20" />
            <div className="flex justify-between text-[10px] md:text-xs font-mono mt-1 text-primary gap-2">
              <span>{processed} PROCESSED</span>
              <span>{total} TOTAL</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${active ? 'bg-primary shadow-[0_0_10px_#22c55e]' : 'bg-red-500 shadow-[0_0_10px_#ef4444]'}`} />
            <span className={`font-mono text-[10px] md:text-xs uppercase ${active ? 'text-primary' : 'text-muted-foreground'}`}>
              {active ? 'PROCESSING' : 'STANDBY'}
            </span>
          </div>
        </div>
      </div>

      {/* Terminal Logs */}
      <div className="md:col-span-2 bg-black border border-border/30 rounded-lg p-0 flex flex-col h-[120px] md:h-[140px] overflow-hidden font-mono text-[10px] md:text-xs relative group">
        <div className="absolute inset-0 pointer-events-none border border-primary/5 rounded-lg z-20 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]" />
        
        <div className="flex items-center justify-between px-2 md:px-3 py-1 bg-muted/10 border-b border-white/5">
          <div className="flex items-center gap-1.5 md:gap-2 text-muted-foreground">
            <Terminal className="w-3 h-3" />
            <span className="uppercase tracking-wider text-[9px] md:text-[10px]">System Log</span>
          </div>
          <Wifi className={`w-3 h-3 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
        </div>

        <div className="flex-1 overflow-y-auto p-2 md:p-3 space-y-0.5 md:space-y-1 font-mono custom-scrollbar" data-testid="system-log">
          {logs.length === 0 ? (
            <div className="text-muted-foreground/30 italic text-[10px] md:text-xs">System ready. Waiting for input...</div>
          ) : (
            logs.map((log, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`text-[10px] md:text-xs break-all ${
                  log.type === 'error' ? 'text-destructive' : 
                  log.type === 'success' ? 'text-primary' : 
                  'text-muted-foreground'
                }`}
              >
                <span className="opacity-50 mr-1 md:mr-2">[{new Date().toLocaleTimeString()}]</span>
                {log.message}
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
