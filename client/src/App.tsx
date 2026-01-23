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
import { BackgroundMusic } from "@/components/BackgroundMusic";
import Home from "@/pages/Home";
import Settings from "@/pages/Settings";
import Profile from "@/pages/Profile";
import Loading from "@/pages/Loading";
import NotFound from "@/pages/not-found";

function AppContent() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const [showLoading, setShowLoading] = useState(true);
  const [loadingComplete, setLoadingComplete] = useState(false);

  useEffect(() => {
    if (!isLoading && loadingComplete) {
      setShowLoading(false);
    }
  }, [isLoading, loadingComplete]);

  if (showLoading) {
    return <Loading onComplete={() => setLoadingComplete(true)} />;
  }

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/profile" component={Profile} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CheckerProvider>
          <ThemeProvider>
            <TutorialProvider>
              <TooltipProvider>
                <div className="min-h-screen bg-background text-foreground">
                  <BackgroundMusic />
                  <AppContent />
                  <Toaster />
                </div>
              </TooltipProvider>
            </TutorialProvider>
          </ThemeProvider>
        </CheckerProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
