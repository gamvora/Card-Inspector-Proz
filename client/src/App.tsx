import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ThemeProvider } from "@/lib/ThemeProvider";
import { CheckerProvider } from "@/lib/checker-context";
import { TutorialProvider } from "@/lib/tutorial-context";
import { useState, useEffect } from "react";
import { initBackgroundMusic } from "@/components/BackgroundMusic";
import { Captcha, isCaptchaVerified } from "@/components/Captcha";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Home from "@/pages/Home";
import Settings from "@/pages/Settings";
import Profile from "@/pages/Profile";
import Rewards from "@/pages/Rewards";
import Loading from "@/pages/Loading";
import NotFound from "@/pages/not-found";

function AppContent() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const [showLoading, setShowLoading] = useState(true);
  const [loadingComplete, setLoadingComplete] = useState(false);
  const [captchaVerified, setCaptchaVerified] = useState(() => {
    try {
      return isCaptchaVerified();
    } catch (error) {
      console.error("[App] Failed to check captcha verification, defaulting to unverified:", error);
      return false;
    }
  });

  useEffect(() => {
    console.log("[App] Mounted. isLoading:", isLoading, "isAuthenticated:", isAuthenticated, "user:", user);
    try {
      initBackgroundMusic();
    } catch (error) {
      console.error("[App] Failed to init background music:", error);
    }
  }, []);

  useEffect(() => {
    console.log("[App] Auth state changed. isLoading:", isLoading, "loadingComplete:", loadingComplete);
    if (!isLoading && loadingComplete) {
      setShowLoading(false);
    }
  }, [isLoading, loadingComplete]);

  if (!captchaVerified) {
    return (
      <Captcha
        onVerified={() => {
          console.log("[App] Captcha verified");
          setCaptchaVerified(true);
        }}
      />
    );
  }

  if (showLoading) {
    return (
      <Loading
        onComplete={() => {
          console.log("[App] Loading screen complete");
          setLoadingComplete(true);
        }}
      />
    );
  }

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/profile" component={Profile} />
      <Route path="/settings" component={Settings} />
      <Route path="/rewards" component={Rewards} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <CheckerProvider>
            <ThemeProvider>
              <TutorialProvider>
                <TooltipProvider>
                  <div className="min-h-screen bg-background text-foreground">
                    <AppContent />
                    <Toaster />
                  </div>
                </TooltipProvider>
              </TutorialProvider>
            </ThemeProvider>
          </CheckerProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
