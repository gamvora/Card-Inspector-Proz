import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth';

interface LoadingProps {
  onComplete: () => void;
}

export default function Loading({ onComplete }: LoadingProps) {
  const { user } = useAuth();
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    const timer1 = setTimeout(() => setShowWelcome(true), 300);
    const timer2 = setTimeout(() => onComplete(), 2500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [onComplete]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-purple-950/30 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-30">
        <div 
          className="absolute inset-0" 
          style={{
            backgroundImage: `
              linear-gradient(rgba(147, 197, 253, 0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(147, 197, 253, 0.3) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 flex flex-col items-center"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="relative mb-8"
        >
          <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 shadow-2xl shadow-purple-500/20 flex items-center justify-center overflow-hidden border-4 border-white dark:border-slate-700">
            <motion.div
              animate={{ 
                boxShadow: [
                  '0 0 20px rgba(168, 85, 247, 0.4)',
                  '0 0 40px rgba(168, 85, 247, 0.6)',
                  '0 0 20px rgba(168, 85, 247, 0.4)'
                ]
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-full h-full bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center"
            >
              <span className="text-4xl font-bold text-white">
                {user?.firstName?.charAt(0) || 'N'}
              </span>
            </motion.div>
          </div>
          
          <motion.div
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.5, 1, 0.5]
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute -inset-3 rounded-[2rem] bg-gradient-to-r from-purple-500/20 via-transparent to-blue-500/20 -z-10 blur-xl"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: showWelcome ? 1 : 0, y: showWelcome ? 0 : 10 }}
          transition={{ duration: 0.4 }}
          className="text-center"
        >
          <h1 className="text-3xl font-light text-slate-700 dark:text-slate-200 mb-2">
            Welcome
          </h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-violet-600 dark:from-purple-400 dark:to-violet-400 bg-clip-text text-transparent"
          >
            {user?.firstName || 'User'}
          </motion.p>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="absolute bottom-20 flex items-center gap-2 text-amber-500"
      >
        <motion.div
          animate={{ rotate: [0, 15, -15, 0] }}
          transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
        >
          <Zap className="w-5 h-5" />
        </motion.div>
        <span className="text-base font-medium">Loading Magic</span>
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, 180, 360]
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Sparkles className="w-5 h-5" />
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 text-xs text-slate-400"
      >
        @lucee7
      </motion.div>
    </div>
  );
}
