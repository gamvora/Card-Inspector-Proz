import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth, authFetch } from './auth';
import TutorialOverlay from '@/components/TutorialOverlay';

interface TutorialContextType {
  showTutorial: boolean;
  startTutorial: () => void;
  closeTutorial: () => void;
  completeTutorial: () => void;
}

const TutorialContext = createContext<TutorialContextType | null>(null);

export function TutorialProvider({ children }: { children: ReactNode }) {
  const { user, refreshUser } = useAuth();
  const [showTutorial, setShowTutorial] = useState(false);
  const [hasCheckedInitial, setHasCheckedInitial] = useState(false);

  useEffect(() => {
    if (user && !hasCheckedInitial) {
      setHasCheckedInitial(true);
      if (!user.hasSeenTutorial) {
        setTimeout(() => {
          setShowTutorial(true);
        }, 1500);
      }
    }
  }, [user, hasCheckedInitial]);

  const startTutorial = useCallback(() => {
    setShowTutorial(true);
  }, []);

  const closeTutorial = useCallback(() => {
    setShowTutorial(false);
  }, []);

  const completeTutorial = useCallback(async () => {
    setShowTutorial(false);
    try {
      await authFetch('/api/tutorial/complete', { method: 'POST' });
      await refreshUser();
    } catch (error) {
      console.error('Failed to mark tutorial as complete:', error);
    }
  }, [refreshUser]);

  return (
    <TutorialContext.Provider value={{ showTutorial, startTutorial, closeTutorial, completeTutorial }}>
      {children}
      <TutorialOverlay 
        isOpen={showTutorial} 
        onClose={closeTutorial} 
        onComplete={completeTutorial} 
      />
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
}
