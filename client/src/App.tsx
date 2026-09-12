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
      console.error("[App] Failed to read captcha verification state:", error);
      return false;
    }
  });

  useEffect(() => {
    try {
      initBackgroundMusic();
    } catch (error) {
      console.error("[App] initBackgroundMusic failed (non-fatal):", error);
    }
  }, []);

  useEffect(() => {
    if (!isLoading && loadingComplete) {
      setShowLoading(false);
    }
  }, [isLoading, loadingComplete]);

  useEffect(() => {
    console.log("[App] state:", {
      isLoading,
      isAuthenticated,
      captchaVerified,
      showLoading,
      loadingComplete,
    });
  }, [isLoading, isAuthenticated, captchaVerified, showLoading, loadingComplete]);

  if (!captchaVerified) {
    console.log("[App] Rendering Captcha screen");
    return <Captcha onVerified={() => setCaptchaVerified(true)} />;
  }

  if (showLoading) {
    console.log("[App] Rendering Loading screen");
    return <Loading onComplete={() => setLoadingComplete(true)} />;
  }

  console.log("[App] Rendering main routes");
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
  console.log("[App] App component mounting");
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <CheckerProvider>
            <ThemeProvider>
              <TutorialProvider>
                <TooltipProvider>
                  <div className="min-h-screen bg-background text-foreground">
                    <ErrorBoundary>
                      <AppContent />
                    </ErrorBoundary>
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
