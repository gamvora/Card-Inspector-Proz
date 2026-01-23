import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, ShieldCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CaptchaProps {
  onVerified: () => void;
}

interface CaptchaData {
  id: string;
  numbers: string;
}

export function Captcha({ onVerified }: CaptchaProps) {
  const [captcha, setCaptcha] = useState<CaptchaData | null>(null);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchCaptcha = async () => {
    setIsLoading(true);
    setError("");
    setAnswer("");
    try {
      const res = await fetch("/api/captcha");
      if (!res.ok) throw new Error("Failed to load captcha");
      const data = await res.json();
      setCaptcha(data);
    } catch (e) {
      setError("Failed to load captcha. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCaptcha();
  }, []);

  useEffect(() => {
    if (captcha && inputRef.current) {
      inputRef.current.focus();
    }
  }, [captcha]);

  const handleVerify = async () => {
    if (!captcha || !answer.trim()) {
      setError("Please enter the code");
      return;
    }

    setIsVerifying(true);
    setError("");

    try {
      const res = await fetch("/api/captcha/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: captcha.id, answer: answer.trim() }),
      });

      const data = await res.json();

      if (data.valid) {
        localStorage.setItem("captcha_verified", Date.now().toString());
        onVerified();
      } else {
        setAttempts((prev) => prev + 1);
        setError("Incorrect code. Please try again.");
        setAnswer("");
        fetchCaptcha();
      }
    } catch (e) {
      setError("Verification failed. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleVerify();
    }
  };

  const renderCaptchaImage = () => {
    if (!captcha) return null;

    const colors = ["#00ff88", "#00d4ff", "#ff6b6b", "#ffd93d", "#c792ea", "#82aaff"];
    
    return (
      <div className="relative w-full h-20 rounded-lg overflow-hidden bg-gradient-to-br from-[#1a1a2e] to-[#16213e] flex items-center justify-center">
        <svg className="absolute inset-0 w-full h-full opacity-30">
          {[...Array(6)].map((_, i) => (
            <path
              key={i}
              d={`M${Math.random() * 200},${Math.random() * 80} Q${Math.random() * 200},${Math.random() * 80} ${Math.random() * 200},${Math.random() * 80}`}
              stroke="rgba(128,128,128,0.5)"
              fill="none"
              strokeWidth="1"
            />
          ))}
        </svg>
        
        <div className="relative flex gap-3 select-none">
          {captcha.numbers.split("").map((char, i) => {
            const color = colors[Math.floor(Math.random() * colors.length)];
            const rotation = (Math.random() - 0.5) * 20;
            const yOffset = (Math.random() - 0.5) * 10;
            
            return (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 20, scale: 0 }}
                animate={{ 
                  opacity: 1, 
                  y: yOffset, 
                  scale: 1,
                  rotate: rotation 
                }}
                transition={{ delay: i * 0.1, type: "spring" }}
                className="text-4xl font-bold"
                style={{ 
                  color,
                  textShadow: `0 0 10px ${color}`,
                  transform: `rotate(${rotation}deg)`,
                }}
              >
                {char}
              </motion.span>
            );
          })}
        </div>

        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              backgroundColor: `rgba(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255},0.4)`,
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm space-y-6"
      >
        <div className="text-center space-y-2">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", bounce: 0.5 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 mb-4"
          >
            <ShieldCheck className="w-8 h-8 text-primary" />
          </motion.div>
          <h1 className="text-2xl font-bold text-foreground">Security Check</h1>
          <p className="text-sm text-muted-foreground">
            Enter the numbers shown below to continue
          </p>
        </div>

        <div className="bg-card rounded-xl p-6 space-y-4 border border-border">
          {isLoading ? (
            <div className="h-20 rounded-lg bg-muted animate-pulse flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-muted-foreground animate-spin" />
            </div>
          ) : (
            renderCaptchaImage()
          )}

          <div className="flex gap-2">
            <Input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              placeholder="Enter code"
              value={answer}
              onChange={(e) => setAnswer(e.target.value.replace(/\D/g, ""))}
              onKeyDown={handleKeyDown}
              className="text-center text-xl font-mono tracking-widest"
              disabled={isVerifying || isLoading}
              data-testid="input-captcha"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchCaptcha}
              disabled={isLoading || isVerifying}
              data-testid="button-refresh-captcha"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-2 text-sm text-destructive"
              >
                <AlertCircle className="w-4 h-4" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <Button
            className="w-full"
            onClick={handleVerify}
            disabled={isVerifying || isLoading || answer.length !== 4}
            data-testid="button-verify-captcha"
          >
            {isVerifying ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify"
            )}
          </Button>

          {attempts > 0 && (
            <p className="text-xs text-center text-muted-foreground">
              Attempts: {attempts}
            </p>
          )}
        </div>

        <p className="text-xs text-center text-muted-foreground">
          This helps protect NexusChecker from automated access
        </p>
      </motion.div>
    </div>
  );
}

export function isCaptchaVerified(): boolean {
  const verified = localStorage.getItem("captcha_verified");
  if (!verified) return false;
  
  const verifiedTime = parseInt(verified, 10);
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  
  return now - verifiedTime < oneHour;
}

export function clearCaptchaVerification(): void {
  localStorage.removeItem("captcha_verified");
}
