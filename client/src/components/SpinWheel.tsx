import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Gift, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpinWheelProps {
  prizes: number[];
  onSpin: () => Promise<{ creditsWon: number; prizeIndex: number }>;
  canSpin: boolean;
  isSpinning?: boolean;
}

export function SpinWheel({ prizes, onSpin, canSpin, isSpinning: externalSpinning }: SpinWheelProps) {
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [wonPrize, setWonPrize] = useState<number | null>(null);
  const wheelRef = useRef<HTMLDivElement>(null);

  const segmentAngle = 360 / prizes.length;
  const colors = [
    "from-purple-600 to-purple-700",
    "from-pink-500 to-pink-600",
    "from-blue-500 to-blue-600",
    "from-green-500 to-green-600",
    "from-yellow-500 to-yellow-600",
    "from-red-500 to-red-600",
  ];

  const handleSpin = async () => {
    if (!canSpin || isSpinning || externalSpinning) return;

    setIsSpinning(true);
    setWonPrize(null);

    try {
      const result = await onSpin();
      const targetAngle = segmentAngle * result.prizeIndex;
      const spins = 5 + Math.random() * 3;
      const finalRotation = rotation + spins * 360 + (360 - targetAngle - segmentAngle / 2);
      
      setRotation(finalRotation);
      
      setTimeout(() => {
        setWonPrize(result.creditsWon);
        setIsSpinning(false);
      }, 4000);
    } catch (error) {
      setIsSpinning(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4" data-testid="spin-wheel-container">
      <div className="relative">
        <div 
          className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10"
          data-testid="spin-pointer"
        >
          <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[20px] border-t-yellow-400 drop-shadow-lg" />
        </div>

        <motion.div
          ref={wheelRef}
          className="relative w-64 h-64 rounded-full border-4 border-white/20 shadow-2xl overflow-hidden"
          style={{ rotate: rotation }}
          animate={{ rotate: rotation }}
          transition={{ duration: 4, ease: [0.32, 0.72, 0, 1] }}
          data-testid="spin-wheel"
        >
          {prizes.map((prize, index) => {
            const startAngle = index * segmentAngle;
            return (
              <div
                key={index}
                className={cn(
                  "absolute w-1/2 h-1/2 origin-bottom-right",
                  "flex items-center justify-center"
                )}
                style={{
                  transform: `rotate(${startAngle}deg) skewY(${90 - segmentAngle}deg)`,
                  transformOrigin: "bottom right",
                  left: 0,
                  top: 0,
                }}
              >
                <div
                  className={cn(
                    "absolute inset-0 bg-gradient-to-br",
                    colors[index % colors.length]
                  )}
                  style={{ transform: `skewY(${-(90 - segmentAngle)}deg)` }}
                />
                <span
                  className="absolute text-white font-bold text-sm drop-shadow-lg"
                  style={{
                    transform: `skewY(${-(90 - segmentAngle)}deg) rotate(${segmentAngle / 2}deg) translateX(30px)`,
                    textShadow: "2px 2px 4px rgba(0,0,0,0.5)"
                  }}
                >
                  {prize}
                </span>
              </div>
            );
          })}
          
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 border-4 border-white shadow-lg flex items-center justify-center z-10">
              <Gift className="w-6 h-6 text-white" />
            </div>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {wonPrize !== null && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="flex items-center gap-2 text-xl font-bold text-green-500"
            data-testid="spin-result"
          >
            <Sparkles className="w-5 h-5" />
            +{wonPrize} Credits!
            <Sparkles className="w-5 h-5" />
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        onClick={handleSpin}
        disabled={!canSpin || isSpinning || externalSpinning}
        size="lg"
        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold px-8"
        data-testid="button-spin"
      >
        {isSpinning || externalSpinning ? (
          <span className="flex items-center gap-2">
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Gift className="w-5 h-5" />
            </motion.span>
            Spinning...
          </span>
        ) : canSpin ? (
          <span className="flex items-center gap-2">
            <Gift className="w-5 h-5" />
            Spin Now!
          </span>
        ) : (
          "Come back tomorrow!"
        )}
      </Button>
    </div>
  );
}