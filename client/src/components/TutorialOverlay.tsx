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
  XCircle,
  Settings,
  Sparkles,
  HelpCircle,
  Coins,
  Shield,
  User,
  Palette,
  MousePointer2,
  Zap
} from "lucide-react";

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  animation: React.ReactNode;
}

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!sharedAudioContext) {
      sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return sharedAudioContext;
  } catch (e) {
    return null;
  }
}

function playClickSound() {
  const audioContext = getAudioContext();
  if (!audioContext) return;
  
  try {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = "sine";
    gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.08);
  } catch (e) {
    // Audio error
  }
}

function playSuccessSound() {
  const audioContext = getAudioContext();
  if (!audioContext) return;
  
  try {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 523.25;
    oscillator.type = "sine";
    gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.15);
    
    setTimeout(() => {
      if (!audioContext) return;
      try {
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();
        osc2.connect(gain2);
        gain2.connect(audioContext.destination);
        osc2.frequency.value = 659.25;
        osc2.type = "sine";
        gain2.gain.setValueAtTime(0.08, audioContext.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
        osc2.start(audioContext.currentTime);
        osc2.stop(audioContext.currentTime + 0.15);
      } catch (e) {}
    }, 80);
  } catch (e) {
    // Audio error
  }
}

function AnimatedCursor({ path }: { path: { x: number; y: number }[] }) {
  return (
    <motion.div
      className="absolute z-10 pointer-events-none"
      animate={{
        x: path.map(p => p.x),
        y: path.map(p => p.y),
      }}
      transition={{
        duration: path.length * 0.5,
        repeat: Infinity,
        repeatDelay: 1,
        ease: "easeInOut"
      }}
    >
      <MousePointer2 className="w-5 h-5 text-white drop-shadow-lg" fill="white" />
      <motion.div
        className="absolute top-1 left-1 w-3 h-3 bg-purple-500 rounded-full"
        animate={{ scale: [0, 1.5, 0], opacity: [0, 0.5, 0] }}
        transition={{ duration: 0.5, repeat: Infinity, repeatDelay: path.length * 0.5 - 0.5 }}
      />
    </motion.div>
  );
}

function WelcomeAnimation() {
  return (
    <div className="w-full h-28 bg-gradient-to-br from-purple-600/30 to-indigo-600/30 rounded-xl flex items-center justify-center overflow-hidden relative">
      <motion.div
        animate={{ 
          scale: [1, 1.15, 1],
          rotate: [0, 5, -5, 0]
        }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="relative">
          <Sparkles className="w-14 h-14 text-purple-400" />
          <motion.div
            className="absolute -top-1 -right-1"
            animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <Zap className="w-5 h-5 text-yellow-400" />
          </motion.div>
        </div>
      </motion.div>
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
        animate={{ x: ["-100%", "100%"] }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}

function CreditsAnimation() {
  const [credits, setCredits] = useState(80);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCredits(prev => {
        if (prev <= 75) return 80;
        return prev - 1;
      });
    }, 800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-28 bg-gradient-to-br from-amber-600/20 to-orange-600/20 rounded-xl p-3 relative overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Coins className="w-5 h-5 text-amber-400" />
          <span className="text-amber-300 text-sm font-medium">Your Credits</span>
        </div>
      </div>
      <motion.div
        key={credits}
        initial={{ scale: 1.3, color: "#f87171" }}
        animate={{ scale: 1, color: "#fbbf24" }}
        className="text-3xl font-bold text-amber-400 text-center"
      >
        {credits}
      </motion.div>
      <p className="text-xs text-amber-300/70 text-center mt-1">1 credit = 1 card check</p>
      <AnimatedCursor path={[{ x: 80, y: 50 }, { x: 100, y: 60 }, { x: 80, y: 50 }]} />
    </div>
  );
}

function CardsAnimation() {
  const [text, setText] = useState("");
  const fullText = "4532015112830366|09|27|123";
  
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
    }, 80);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-28 bg-slate-800/80 rounded-xl p-3 font-mono text-xs overflow-hidden relative">
      <div className="text-green-400 flex items-center">
        {text}
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity }}
          className="inline-block w-1.5 h-3 bg-green-400 ml-0.5"
        />
      </div>
      <div className="text-slate-500 mt-1.5 text-[10px]">4111111111111111|12|25|456</div>
      <div className="text-slate-600 text-[10px]">5425233430109903|08|26|789</div>
      <AnimatedCursor path={[{ x: 20, y: 15 }, { x: 120, y: 15 }, { x: 140, y: 15 }]} />
    </div>
  );
}

function SiteAnimation() {
  const [siteIndex, setSiteIndex] = useState(0);
  const sites = ["Nike Store", "Adidas", "Supreme"];
  
  useEffect(() => {
    const interval = setInterval(() => {
      setSiteIndex((prev) => (prev + 1) % sites.length);
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-28 bg-slate-800/80 rounded-xl p-3 flex items-center justify-center relative">
      <div className="flex items-center gap-3">
        <motion.div
          whileHover={{ scale: 1.1 }}
          className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center"
        >
          <ChevronLeft className="w-4 h-4 text-slate-400" />
        </motion.div>
        <motion.div
          key={siteIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600/30 to-indigo-600/30 border border-purple-500/30 min-w-[100px] text-center"
        >
          <div className="flex items-center justify-center gap-1.5">
            <Globe className="w-3 h-3 text-purple-400" />
            <span className="text-white text-sm font-medium">{sites[siteIndex]}</span>
          </div>
        </motion.div>
        <motion.div
          animate={{ x: [0, 3, 0] }}
          transition={{ duration: 0.8, repeat: Infinity }}
          className="w-7 h-7 rounded-lg bg-purple-600 flex items-center justify-center"
        >
          <ChevronRight className="w-4 h-4 text-white" />
        </motion.div>
      </div>
      <AnimatedCursor path={[{ x: 145, y: 45 }, { x: 155, y: 45 }, { x: 145, y: 45 }]} />
    </div>
  );
}

function StartAnimation() {
  const [isChecking, setIsChecking] = useState(false);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setIsChecking(prev => !prev);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-28 bg-slate-800/80 rounded-xl p-3 flex items-center justify-center relative">
      <motion.div
        animate={isChecking ? { scale: [1, 0.95, 1] } : {}}
        transition={{ duration: 0.3 }}
        className={`px-6 py-3 rounded-xl font-bold text-white flex items-center gap-2 ${
          isChecking 
            ? "bg-gradient-to-r from-rose-500 to-pink-500" 
            : "bg-gradient-to-r from-emerald-500 to-green-500"
        }`}
      >
        {isChecking ? (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
            />
            Stop
          </>
        ) : (
          <>
            <Play className="w-4 h-4" fill="white" />
            Start
          </>
        )}
      </motion.div>
      <AnimatedCursor path={[{ x: 70, y: 30 }, { x: 90, y: 55 }, { x: 90, y: 55 }]} />
    </div>
  );
}

function ResultsAnimation() {
  const results = [
    { card: "4532***0366", status: "live" },
    { card: "4111***1111", status: "dead" },
    { card: "5425***9903", status: "live" },
  ];
  const [showIndex, setShowIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setShowIndex(prev => (prev + 1) % (results.length + 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-28 bg-slate-800/80 rounded-xl p-2 overflow-hidden relative">
      <div className="flex gap-1 mb-2">
        <div className="flex-1 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold text-center">
          LIVE
        </div>
        <div className="flex-1 py-1 rounded-lg bg-slate-700 text-slate-400 text-[10px] font-semibold text-center">
          DEAD
        </div>
      </div>
      <div className="space-y-1">
        {results.slice(0, showIndex).map((result, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={`flex items-center justify-between p-1.5 rounded-lg ${
              result.status === "live" ? "bg-emerald-500/10" : "bg-rose-500/10"
            }`}
          >
            <span className="text-[10px] font-mono text-white">{result.card}</span>
            {result.status === "live" ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            ) : (
              <XCircle className="w-3 h-3 text-rose-400" />
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function ProxyAnimation() {
  const [step, setStep] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setStep(prev => (prev + 1) % 4);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-28 bg-slate-800/80 rounded-xl p-3 relative overflow-hidden">
      <div className="flex items-center gap-2 mb-2">
        <Shield className="w-4 h-4 text-indigo-400" />
        <span className="text-indigo-300 text-xs font-medium">Proxy Protection</span>
      </div>
      <div className="bg-slate-900/50 rounded-lg p-2 font-mono text-[10px]">
        <motion.div
          key={step}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-indigo-400"
        >
          {step === 0 && "proxy.example.com:8080"}
          {step === 1 && "Testing connection..."}
          {step === 2 && <span className="text-emerald-400">Connected! 45ms</span>}
          {step === 3 && <span className="text-emerald-400">IP: 185.xxx.xxx.xxx</span>}
        </motion.div>
      </div>
      <p className="text-[9px] text-slate-400 mt-1">Format: host:port:user:pass</p>
      <AnimatedCursor path={[{ x: 60, y: 50 }, { x: 100, y: 50 }, { x: 60, y: 50 }]} />
    </div>
  );
}

function AddSiteAnimation() {
  const [step, setStep] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setStep(prev => (prev + 1) % 3);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-28 bg-slate-800/80 rounded-xl p-3 relative overflow-hidden">
      <div className="flex items-center gap-2 mb-2">
        <Globe className="w-4 h-4 text-rose-400" />
        <span className="text-rose-300 text-xs font-medium">Add Shopify Site</span>
      </div>
      <div className="space-y-1.5">
        <div className="bg-slate-900/50 rounded-lg p-1.5">
          <p className="text-[9px] text-slate-500 mb-0.5">Site Name</p>
          <motion.p key={`name-${step}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] text-white">
            {step >= 1 ? "My Nike Store" : ""}
          </motion.p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-1.5">
          <p className="text-[9px] text-slate-500 mb-0.5">URL</p>
          <motion.p key={`url-${step}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] text-white">
            {step >= 2 ? "nike-store.myshopify.com" : ""}
          </motion.p>
        </div>
      </div>
      <AnimatedCursor path={[{ x: 60, y: 40 }, { x: 100, y: 40 }, { x: 60, y: 70 }, { x: 120, y: 70 }]} />
    </div>
  );
}

function ProfileAnimation() {
  return (
    <div className="w-full h-28 bg-slate-800/80 rounded-xl p-3 relative overflow-hidden">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
          <User className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-white text-sm font-medium">Your Profile</p>
          <p className="text-slate-400 text-[10px]">View stats & leaderboard</p>
        </div>
      </div>
      <div className="flex gap-2 mt-2">
        <div className="flex-1 bg-emerald-500/10 rounded-lg p-1.5 text-center">
          <p className="text-emerald-400 text-sm font-bold">156</p>
          <p className="text-[8px] text-emerald-300/70">Live</p>
        </div>
        <div className="flex-1 bg-rose-500/10 rounded-lg p-1.5 text-center">
          <p className="text-rose-400 text-sm font-bold">89</p>
          <p className="text-[8px] text-rose-300/70">Dead</p>
        </div>
        <div className="flex-1 bg-amber-500/10 rounded-lg p-1.5 text-center">
          <p className="text-amber-400 text-sm font-bold">63%</p>
          <p className="text-[8px] text-amber-300/70">Rate</p>
        </div>
      </div>
    </div>
  );
}

function ThemeAnimation() {
  const [theme, setTheme] = useState(0);
  const themes = [
    { name: "Dark", colors: ["#1e1b4b", "#312e81"] },
    { name: "Nighty", colors: ["#581c87", "#7e22ce"] },
    { name: "Forest", colors: ["#14532d", "#166534"] },
  ];
  
  useEffect(() => {
    const interval = setInterval(() => {
      setTheme(prev => (prev + 1) % themes.length);
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-28 bg-slate-800/80 rounded-xl p-3 relative overflow-hidden">
      <div className="flex items-center gap-2 mb-2">
        <Palette className="w-4 h-4 text-pink-400" />
        <span className="text-pink-300 text-xs font-medium">Change Theme</span>
      </div>
      <div className="flex gap-2 justify-center">
        {themes.map((t, i) => (
          <motion.div
            key={t.name}
            animate={{ scale: i === theme ? 1.1 : 1, borderColor: i === theme ? "#a855f7" : "transparent" }}
            className="w-12 h-12 rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 cursor-pointer"
            style={{ background: `linear-gradient(135deg, ${t.colors[0]}, ${t.colors[1]})` }}
          >
            <div className="w-3 h-3 rounded-full bg-white/30" />
            <span className="text-[8px] text-white/70">{t.name}</span>
          </motion.div>
        ))}
      </div>
      <AnimatedCursor path={[{ x: 50, y: 60 }, { x: 90, y: 60 }, { x: 130, y: 60 }]} />
    </div>
  );
}

function TipsAnimation() {
  const tips = [
    "Use a proxy for better success rate",
    "Check cards in small batches",
    "Live cards work on any site",
  ];
  const [tipIndex, setTipIndex] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex(prev => (prev + 1) % tips.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-28 bg-gradient-to-br from-emerald-600/20 to-teal-600/20 rounded-xl p-3 flex flex-col items-center justify-center relative overflow-hidden">
      <Zap className="w-6 h-6 text-emerald-400 mb-2" />
      <motion.p
        key={tipIndex}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-emerald-300 text-xs text-center font-medium"
      >
        {tips[tipIndex]}
      </motion.p>
    </div>
  );
}

const tutorialSteps: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to NexusChecker",
    description: "Your powerful Shopify card checker. This quick guide will show you everything you need to know!",
    icon: <Sparkles className="w-4 h-4" />,
    animation: <WelcomeAnimation />
  },
  {
    id: "credits",
    title: "Credits System",
    description: "Each card check costs 1 credit. New users get 80 free credits. Credits are deducted when you start checking.",
    icon: <Coins className="w-4 h-4" />,
    animation: <CreditsAnimation />
  },
  {
    id: "cards",
    title: "Enter Your Cards",
    description: "Paste your cards in the input box. Format: CardNumber|Month|Year|CVV. One card per line.",
    icon: <CreditCard className="w-4 h-4" />,
    animation: <CardsAnimation />
  },
  {
    id: "site",
    title: "Select Shopify Site",
    description: "Use the arrows to pick which Shopify store to check against. Different sites may give different results.",
    icon: <Globe className="w-4 h-4" />,
    animation: <SiteAnimation />
  },
  {
    id: "start",
    title: "Start Checking",
    description: "Press Start to begin. Cards are checked in parallel for speed. Press Stop anytime to cancel.",
    icon: <Play className="w-4 h-4" />,
    animation: <StartAnimation />
  },
  {
    id: "results",
    title: "View Results",
    description: "LIVE = Card is valid and chargeable. DEAD = Card declined. Copy cards from the results list.",
    icon: <CheckCircle2 className="w-4 h-4" />,
    animation: <ResultsAnimation />
  },
  {
    id: "proxy",
    title: "Add Your Proxy",
    description: "Add a proxy in Settings for better success rates. Format: host:port:user:pass. Proxy is tested before saving.",
    icon: <Shield className="w-4 h-4" />,
    animation: <ProxyAnimation />
  },
  {
    id: "addsite",
    title: "Add Shopify Sites",
    description: "In Settings, add your own Shopify sites. Enter a name and the store URL (e.g. store.myshopify.com).",
    icon: <Globe className="w-4 h-4" />,
    animation: <AddSiteAnimation />
  },
  {
    id: "profile",
    title: "Your Profile",
    description: "Check your stats, hit rate, and compete on the leaderboard! See who has the most live cards.",
    icon: <User className="w-4 h-4" />,
    animation: <ProfileAnimation />
  },
  {
    id: "theme",
    title: "Customize Theme",
    description: "Pick your favorite theme from Settings. Choose Dark, Nighty, Forest, Sunset and more!",
    icon: <Palette className="w-4 h-4" />,
    animation: <ThemeAnimation />
  },
  {
    id: "tips",
    title: "Pro Tips",
    description: "Use proxies for better results. Check in small batches (10-20 cards). Live cards work on any Shopify store!",
    icon: <Zap className="w-4 h-4" />,
    animation: <TipsAnimation />
  }
];

interface TutorialOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export default function TutorialOverlay({ isOpen, onClose, onComplete }: TutorialOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleNext = () => {
    playClickSound();
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      playSuccessSound();
      onComplete();
    }
  };

  const handlePrev = () => {
    playClickSound();
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === "ArrowRight" || e.key === "Enter") {
      playClickSound();
      if (currentStep < tutorialSteps.length - 1) {
        setCurrentStep((prev) => prev + 1);
      } else {
        playSuccessSound();
        onComplete();
      }
    } else if (e.key === "ArrowLeft") {
      playClickSound();
      if (currentStep > 0) {
        setCurrentStep((prev) => prev - 1);
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  }, [isOpen, currentStep, onClose, onComplete]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

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
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none"
        >
          <div className="w-full max-w-xs bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl border border-purple-500/20 overflow-hidden pointer-events-auto">
            <div className="bg-gradient-to-r from-purple-600/20 to-indigo-600/20 p-3 border-b border-slate-700/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white">
                    {step.icon}
                  </div>
                  <span className="text-xs font-medium text-purple-300">
                    {currentStep + 1} / {tutorialSteps.length}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="rounded-lg text-slate-400"
                  aria-label="Close tutorial"
                  data-testid="button-close-tutorial"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="p-4">
              <div className="mb-3">
                {step.animation}
              </div>

              <h3 className="text-lg font-bold text-white mb-1.5 text-center">
                {step.title}
              </h3>
              <p className="text-slate-300 text-xs leading-relaxed text-center mb-3">
                {step.description}
              </p>

              <div className="flex items-center gap-1 mb-3 justify-center">
                {tutorialSteps.map((_, index) => (
                  <motion.div
                    key={index}
                    animate={{ 
                      scale: index === currentStep ? 1.2 : 1,
                      backgroundColor: index <= currentStep ? "#a855f7" : "#334155"
                    }}
                    className="w-1.5 h-1.5 rounded-full"
                  />
                ))}
              </div>

              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="text-slate-400 text-xs"
                  data-testid="button-skip-tutorial"
                >
                  Skip
                </Button>
                
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handlePrev}
                    disabled={currentStep === 0}
                    className="rounded-lg border-slate-700 disabled:opacity-30"
                    aria-label="Previous step"
                    data-testid="button-prev-step"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={handleNext}
                    size="sm"
                    className="px-4 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-medium text-xs"
                    aria-label={currentStep === tutorialSteps.length - 1 ? "Finish tutorial" : "Next step"}
                    data-testid="button-next-step"
                  >
                    {currentStep === tutorialSteps.length - 1 ? "Finish" : "Next"}
                    {currentStep < tutorialSteps.length - 1 && <ChevronRight className="w-3 h-3 ml-1" />}
                  </Button>
                </div>
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
