import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { 
  ChevronLeft, 
  ChevronRight, 
  X, 
  CreditCard, 
  Globe, 
  Play, 
  CheckCircle2,
  Settings,
  Sparkles,
  HelpCircle
} from "lucide-react";

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  targetSelector: string;
  position: "top" | "bottom" | "left" | "right";
  animation: React.ReactNode;
}

const tutorialSteps: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to NexusChecker",
    description: "This guide will help you understand how to use the app. Follow the steps to learn everything!",
    targetSelector: "[data-tutorial='header']",
    position: "bottom",
    animation: <WelcomeAnimation />
  },
  {
    id: "cards",
    title: "Enter Your Cards",
    description: "Enter cards here in this format:\nCard Number|Month|Year|CVV\nYou can enter multiple cards, each on a new line.",
    targetSelector: "[data-tutorial='cards-input']",
    position: "top",
    animation: <CardsAnimation />
  },
  {
    id: "site",
    title: "Select Your Site",
    description: "Use the arrows to choose the Shopify site you want to check on. You can add new sites from Settings.",
    targetSelector: "[data-tutorial='site-selector']",
    position: "top",
    animation: <SiteAnimation />
  },
  {
    id: "start",
    title: "Start Checking",
    description: "Press the Start button to begin checking cards. One credit will be deducted per card.",
    targetSelector: "[data-tutorial='start-button']",
    position: "top",
    animation: <StartAnimation />
  },
  {
    id: "results",
    title: "View Results",
    description: "Check results will appear here:\nAPPROVED = Card is live\nDECLINED = Card is dead",
    targetSelector: "[data-tutorial='results']",
    position: "top",
    animation: <ResultsAnimation />
  },
  {
    id: "settings",
    title: "Settings",
    description: "From the Settings page you can:\n- Add new Shopify sites\n- Add your proxy\n- Change the theme",
    targetSelector: "[data-tutorial='settings-nav']",
    position: "top",
    animation: <SettingsAnimation />
  }
];

function WelcomeAnimation() {
  return (
    <div className="w-full h-32 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-xl flex items-center justify-center overflow-hidden relative">
      <motion.div
        animate={{ 
          scale: [1, 1.2, 1],
          rotate: [0, 10, -10, 0]
        }}
        transition={{ duration: 2, repeat: Infinity }}
        className="text-6xl"
      >
        <Sparkles className="w-16 h-16 text-purple-500" />
      </motion.div>
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
        animate={{ x: ["-100%", "100%"] }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}

function CardsAnimation() {
  const [text, setText] = useState("");
  const fullText = "4532015112830366|09|2027|123";
  
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i <= fullText.length) {
        setText(fullText.slice(0, i));
        i++;
      } else {
        i = 0;
        setText("");
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-32 bg-slate-800 rounded-xl p-3 font-mono text-sm overflow-hidden">
      <div className="text-green-400">
        {text}
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity }}
          className="inline-block w-2 h-4 bg-green-400 ml-0.5"
        />
      </div>
      <div className="text-slate-500 mt-2 text-xs">
        4111111111111111|12|2025|456
      </div>
      <div className="text-slate-600 text-xs">
        5425233430109903|08|2026|789
      </div>
    </div>
  );
}

function SiteAnimation() {
  const [siteIndex, setSiteIndex] = useState(0);
  const sites = ["Nike Store", "Adidas Shop", "Supreme"];
  
  useEffect(() => {
    const interval = setInterval(() => {
      setSiteIndex((prev) => (prev + 1) % sites.length);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-32 bg-slate-800 rounded-xl p-4 flex items-center justify-center">
      <div className="flex items-center gap-4">
        <motion.div
          animate={{ x: [-5, 0, -5] }}
          transition={{ duration: 1, repeat: Infinity }}
          className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5 text-slate-400" />
        </motion.div>
        
        <AnimatePresence mode="wait">
          <motion.div
            key={siteIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-xl border border-emerald-500/30"
          >
            <Globe className="w-5 h-5 text-emerald-400" />
            <span className="text-white font-medium">{sites[siteIndex]}</span>
          </motion.div>
        </AnimatePresence>
        
        <motion.div
          animate={{ x: [0, 5, 0] }}
          transition={{ duration: 1, repeat: Infinity }}
          className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center cursor-pointer"
        >
          <ChevronRight className="w-5 h-5 text-slate-400" />
        </motion.div>
      </div>
    </div>
  );
}

function StartAnimation() {
  const [isActive, setIsActive] = useState(false);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setIsActive((prev) => !prev);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-32 bg-slate-800 rounded-xl p-4 flex items-center justify-center">
      <motion.div
        animate={isActive ? { scale: [1, 0.95, 1] } : {}}
        transition={{ duration: 0.2 }}
        className={`px-8 py-3 rounded-xl font-bold flex items-center gap-2 ${
          isActive 
            ? "bg-gradient-to-r from-rose-500 to-pink-500 text-white" 
            : "bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
        }`}
      >
        {isActive ? (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
            />
            Checking...
          </>
        ) : (
          <>
            <Play className="w-5 h-5" />
            Start Check
          </>
        )}
      </motion.div>
    </div>
  );
}

function ResultsAnimation() {
  const [results, setResults] = useState([
    { card: "4532***0366", status: "live" },
    { card: "4111***1111", status: "dead" },
  ]);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setResults((prev) => [
        ...prev.slice(-2),
        { 
          card: `${Math.floor(Math.random() * 9000) + 1000}***${Math.floor(Math.random() * 9000) + 1000}`, 
          status: Math.random() > 0.5 ? "live" : "dead" 
        }
      ]);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-32 bg-slate-800 rounded-xl p-3 overflow-hidden">
      <div className="space-y-2">
        {results.slice(-3).map((result, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`flex items-center justify-between p-2 rounded-lg ${
              result.status === "live" 
                ? "bg-emerald-500/20 border border-emerald-500/30" 
                : "bg-rose-500/20 border border-rose-500/30"
            }`}
          >
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-mono text-white">{result.card}</span>
            </div>
            {result.status === "live" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <X className="w-4 h-4 text-rose-400" />
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function SettingsAnimation() {
  return (
    <div className="w-full h-32 bg-slate-800 rounded-xl p-4 flex items-center justify-center">
      <div className="flex gap-3">
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 1, repeat: Infinity, delay: 0 }}
          className="w-16 h-16 bg-gradient-to-br from-rose-500/20 to-pink-500/20 rounded-xl flex flex-col items-center justify-center gap-1 border border-rose-500/30"
        >
          <Globe className="w-6 h-6 text-rose-400" />
          <span className="text-[10px] text-rose-400">Sites</span>
        </motion.div>
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
          className="w-16 h-16 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-xl flex flex-col items-center justify-center gap-1 border border-indigo-500/30"
        >
          <Settings className="w-6 h-6 text-indigo-400" />
          <span className="text-[10px] text-indigo-400">Proxy</span>
        </motion.div>
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
          className="w-16 h-16 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl flex flex-col items-center justify-center gap-1 border border-amber-500/30"
        >
          <Sparkles className="w-6 h-6 text-amber-400" />
          <span className="text-[10px] text-amber-400">Theme</span>
        </motion.div>
      </div>
    </div>
  );
}

interface TutorialOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export default function TutorialOverlay({ isOpen, onClose, onComplete }: TutorialOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const updateTargetPosition = useCallback(() => {
    const step = tutorialSteps[currentStep];
    const target = document.querySelector(step.targetSelector);
    if (target) {
      setTargetRect(target.getBoundingClientRect());
    } else {
      setTargetRect(null);
    }
  }, [currentStep]);

  useEffect(() => {
    if (isOpen) {
      updateTargetPosition();
      window.addEventListener("resize", updateTargetPosition);
      window.addEventListener("scroll", updateTargetPosition);
      return () => {
        window.removeEventListener("resize", updateTargetPosition);
        window.removeEventListener("scroll", updateTargetPosition);
      };
    }
  }, [isOpen, currentStep, updateTargetPosition]);

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === "ArrowRight" || e.key === "Enter") {
      handleNext();
    } else if (e.key === "ArrowLeft") {
      handlePrev();
    } else if (e.key === "Escape") {
      onClose();
    }
  }, [isOpen, currentStep]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen) return null;

  const step = tutorialSteps[currentStep];

  return (
    <AnimatePresence>
      <motion.div
        ref={overlayRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] pointer-events-auto"
        role="dialog"
        aria-modal="true"
        aria-label="Tutorial"
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
        
        {targetRect && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute pointer-events-none"
            style={{
              top: targetRect.top - 8,
              left: targetRect.left - 8,
              width: targetRect.width + 16,
              height: targetRect.height + 16,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.7)",
              borderRadius: "16px",
              border: "3px solid #8b5cf6",
            }}
          >
            <motion.div
              animate={{ 
                boxShadow: [
                  "0 0 20px 5px rgba(139, 92, 246, 0.5)",
                  "0 0 40px 10px rgba(139, 92, 246, 0.3)",
                  "0 0 20px 5px rgba(139, 92, 246, 0.5)"
                ]
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 rounded-2xl"
            />
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl shadow-2xl border border-slate-700/50 overflow-hidden z-[10000]"
        >
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                  <HelpCircle className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-medium text-slate-400">
                  Step {currentStep + 1} of {tutorialSteps.length}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 rounded-xl text-slate-400 hover:text-white"
                aria-label="Close tutorial"
                data-testid="button-close-tutorial"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="mb-4">
              {step.animation}
            </div>

            <h3 className="text-xl font-bold text-white mb-2 text-center">
              {step.title}
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line mb-4 text-center">
              {step.description}
            </p>

            <div className="flex items-center gap-2 mb-4">
              {tutorialSteps.map((_, index) => (
                <div
                  key={index}
                  className={`flex-1 h-1.5 rounded-full transition-colors ${
                    index <= currentStep ? "bg-purple-500" : "bg-slate-700"
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                onClick={onClose}
                className="text-slate-400 hover:text-white"
                data-testid="button-skip-tutorial"
              >
                Skip
              </Button>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handlePrev}
                  disabled={currentStep === 0}
                  className="h-10 w-10 rounded-xl border-slate-700"
                  aria-label="Previous step"
                  data-testid="button-prev-step"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <Button
                  onClick={handleNext}
                  className="px-6 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-medium"
                  aria-label={currentStep === tutorialSteps.length - 1 ? "Finish tutorial" : "Next step"}
                  data-testid="button-next-step"
                >
                  {currentStep === tutorialSteps.length - 1 ? "Finish" : "Next"}
                  {currentStep < tutorialSteps.length - 1 && <ChevronRight className="w-4 h-4 ml-1" />}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export function TutorialButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className="h-9 w-9 rounded-xl"
      aria-label="Start tutorial"
      data-testid="button-start-tutorial"
    >
      <HelpCircle className="w-5 h-5 text-purple-500" />
    </Button>
  );
}
