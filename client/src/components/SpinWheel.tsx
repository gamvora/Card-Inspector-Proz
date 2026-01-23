import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Gift, Sparkles, Star, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpinWheelProps {
  prizes: number[];
  onSpin: () => Promise<{ creditsWon: number; prizeIndex: number }>;
  canSpin?: boolean;
  isSpinning?: boolean;
  isLoading?: boolean;
}

const playSpinSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  } catch (e) {}
};

const playWinSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.setValueAtTime(freq, audioContext.currentTime + i * 0.15);
      gainNode.gain.setValueAtTime(0.15, audioContext.currentTime + i * 0.15);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + i * 0.15 + 0.3);
      oscillator.start(audioContext.currentTime + i * 0.15);
      oscillator.stop(audioContext.currentTime + i * 0.15 + 0.3);
    });
  } catch (e) {}
};

export function SpinWheel({ prizes, onSpin, canSpin, isSpinning: externalSpinning, isLoading }: SpinWheelProps) {
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [wonPrize, setWonPrize] = useState<number | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const wheelRef = useRef<HTMLDivElement>(null);

  const segmentAngle = 360 / prizes.length;
  const colors = [
    "from-purple-600 to-purple-800",
    "from-pink-500 to-rose-600",
    "from-blue-500 to-indigo-600",
    "from-emerald-500 to-green-600",
    "from-amber-400 to-orange-500",
    "from-red-500 to-rose-600",
  ];

  const handleSpin = async () => {
    if (!canSpin || isLoading || isSpinning || externalSpinning) return;

    setIsSpinning(true);
    setWonPrize(null);
    setShowConfetti(false);
    playSpinSound();

    try {
      const result = await onSpin();
      const targetAngle = segmentAngle * result.prizeIndex;
      const spins = 5 + Math.random() * 3;
      const finalRotation = rotation + spins * 360 + (360 - targetAngle - segmentAngle / 2);
      
      setRotation(finalRotation);
      
      setTimeout(() => {
        setWonPrize(result.creditsWon);
        setShowConfetti(true);
        setIsSpinning(false);
        playWinSound();
        setTimeout(() => setShowConfetti(false), 3000);
      }, 4000);
    } catch (error) {
      setIsSpinning(false);
    }
  };

  const confettiColors = ["#a855f7", "#ec4899", "#3b82f6", "#22c55e", "#f59e0b", "#ef4444"];

  return (
    <div className="flex flex-col items-center gap-6" data-testid="spin-wheel-container">
      <div className="relative">
        {showConfetti && (
          <div className="absolute inset-0 pointer-events-none z-20">
            {[...Array(30)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-3 h-3 rounded-sm"
                style={{
                  backgroundColor: confettiColors[i % confettiColors.length],
                  left: `${50 + (Math.random() - 0.5) * 100}%`,
                  top: "50%",
                }}
                initial={{ y: 0, x: 0, opacity: 1, rotate: 0 }}
                animate={{
                  y: [(Math.random() - 0.5) * 200 - 100, (Math.random() - 0.5) * 300],
                  x: [(Math.random() - 0.5) * 200, (Math.random() - 0.5) * 300],
                  opacity: [1, 1, 0],
                  rotate: Math.random() * 720,
                }}
                transition={{ duration: 2 + Math.random(), ease: "easeOut" }}
              />
            ))}
          </div>
        )}

        <motion.div 
          className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-3 z-10"
          animate={isSpinning ? { y: [0, -3, 0] } : {}}
          transition={{ duration: 0.15, repeat: isSpinning ? Infinity : 0 }}
          data-testid="spin-pointer"
        >
          <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[24px] border-t-yellow-400 drop-shadow-[0_4px_6px_rgba(234,179,8,0.5)]" />
        </motion.div>

        <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-purple-500/30 via-pink-500/30 to-yellow-500/30 blur-xl animate-pulse" />

        <motion.div
          ref={wheelRef}
          className="relative w-72 h-72 rounded-full border-[6px] border-white/30 shadow-[0_0_40px_rgba(168,85,247,0.4)] overflow-hidden"
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
                    "absolute inset-0 bg-gradient-to-br shadow-inner",
                    colors[index % colors.length]
                  )}
                  style={{ transform: `skewY(${-(90 - segmentAngle)}deg)` }}
                />
                <span
                  className="absolute text-white font-bold text-base drop-shadow-lg"
                  style={{
                    transform: `skewY(${-(90 - segmentAngle)}deg) rotate(${segmentAngle / 2}deg) translateX(35px)`,
                    textShadow: "2px 2px 6px rgba(0,0,0,0.7)"
                  }}
                >
                  +{prize}
                </span>
              </div>
            );
          })}
          
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div 
              className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-300 via-yellow-400 to-amber-500 border-4 border-white shadow-[0_0_20px_rgba(234,179,8,0.6)] flex items-center justify-center z-10"
              animate={isSpinning ? { scale: [1, 1.1, 1] } : {}}
              transition={{ duration: 0.3, repeat: isSpinning ? Infinity : 0 }}
            >
              <Gift className="w-7 h-7 text-white drop-shadow-lg" />
            </motion.div>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {wonPrize !== null && (
          <motion.div
            initial={{ scale: 0, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0, opacity: 0 }}
            className="flex items-center gap-3 text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-500 text-transparent bg-clip-text"
            data-testid="spin-result"
          >
            <motion.span
              animate={{ rotate: [0, 20, -20, 0], scale: [1, 1.2, 1] }}
              transition={{ duration: 0.5, repeat: 2 }}
            >
              <Sparkles className="w-6 h-6 text-yellow-400" />
            </motion.span>
            +{wonPrize} Credits!
            <motion.span
              animate={{ rotate: [0, -20, 20, 0], scale: [1, 1.2, 1] }}
              transition={{ duration: 0.5, repeat: 2 }}
            >
              <Sparkles className="w-6 h-6 text-yellow-400" />
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        whileHover={canSpin && !isLoading ? { scale: 1.02 } : {}}
        whileTap={canSpin && !isLoading ? { scale: 0.98 } : {}}
      >
        <Button
          onClick={handleSpin}
          disabled={isLoading || !canSpin || isSpinning || externalSpinning}
          size="lg"
          className={cn(
            "text-white font-bold px-10 py-6 text-lg shadow-lg",
            isLoading 
              ? "bg-gray-500"
              : canSpin 
                ? "bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 bg-[length:200%_100%] hover:animate-shimmer shadow-purple-500/30"
                : "bg-gray-500"
          )}
          data-testid="button-spin"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Gift className="w-5 h-5" />
              </motion.span>
              Loading...
            </span>
          ) : isSpinning || externalSpinning ? (
            <span className="flex items-center gap-2">
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
              >
                <Zap className="w-5 h-5" />
              </motion.span>
              Spinning...
            </span>
          ) : canSpin ? (
            <span className="flex items-center gap-2">
              <Gift className="w-5 h-5" />
              Spin Now!
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Star className="w-5 h-5" />
              Come back tomorrow!
            </span>
          )}
        </Button>
      </motion.div>
    </div>
  );
}