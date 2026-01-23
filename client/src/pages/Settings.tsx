import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { authFetch } from '@/lib/auth';
import { useAuth } from '@/lib/auth';
import { useTheme, Theme } from '@/lib/ThemeProvider';
import { 
  Globe, 
  Plus, 
  Trash2, 
  CheckCircle, 
  Loader2, 
  Server,
  Save,
  X,
  Radio,
  Home as HomeIcon,
  User,
  Settings as SettingsIcon,
  Zap,
  Shield,
  Wifi,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Activity,
  Sun,
  Moon,
  Laptop,
  Leaf,
  Sunset,
  Stars,
  Palette,
  Eye,
  EyeOff,
  Waves,
  Candy,
  Sparkles,
  Cloud,
} from 'lucide-react';
import { Link } from 'wouter';

const themeOptions: { value: Theme; label: string; icon: typeof Sun; color: string }[] = [
  { value: 'light', label: 'Light', icon: Sun, color: 'text-amber-500' },
  { value: 'dark', label: 'Dark', icon: Moon, color: 'text-slate-400' },
  { value: 'system', label: 'System', icon: Laptop, color: 'text-blue-500' },
  { value: 'nighty', label: 'Nighty', icon: Stars, color: 'text-purple-500' },
  { value: 'forest', label: 'Forest', icon: Leaf, color: 'text-emerald-500' },
  { value: 'sunset', label: 'Sunset', icon: Sunset, color: 'text-orange-500' },
  { value: 'ocean', label: 'Ocean', icon: Waves, color: 'text-cyan-500' },
  { value: 'candy', label: 'Candy', icon: Sparkles, color: 'text-pink-500' },
  { value: 'cyber', label: 'Cyber', icon: Zap, color: 'text-lime-500' },
  { value: 'midnight', label: 'Midnight', icon: Cloud, color: 'text-indigo-500' },
];

interface Site {
  id: number;
  name: string;
  url: string;
  isActive: boolean;
}

interface Proxy {
  id: number;
  proxy: string;
  isValid: boolean;
}

interface ProxyTestResult {
  valid: boolean;
  proxy: string;
  responseTime?: number;
  type?: string;
  hasAuth?: boolean;
  status?: string;
  error?: string;
  ip1?: string;
  ip2?: string;
  isRotating?: boolean;
  speed?: number;
}

import { useCheckerContext } from "@/lib/checker-context";
import { BinLookup } from "@/components/BinLookup";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Gift, Bell } from "lucide-react";

export default function Settings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { stats } = useCheckerContext();
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteUrl, setNewSiteUrl] = useState('');
  const [newProxies, setNewProxies] = useState('');
  const [testingProxy, setTestingProxy] = useState<string | null>(null);
  const [proxyTestResult, setProxyTestResult] = useState<ProxyTestResult | null>(null);
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);
  const [showFullProxy, setShowFullProxy] = useState<number | null>(null);

  const { data: sites = [], isLoading: sitesLoading } = useQuery<Site[]>({
    queryKey: ['/api/sites'],
    queryFn: async () => {
      const res = await authFetch('/api/sites');
      return res.json();
    },
  });

  const { data: proxies = [], isLoading: proxiesLoading } = useQuery<Proxy[]>({
    queryKey: ['/api/proxies'],
    queryFn: async () => {
      const res = await authFetch('/api/proxies');
      return res.json();
    },
  });

  const { data: notifSettings } = useQuery<{
    approvedAlerts: boolean;
    dailySummary: boolean;
    streakReminder: boolean;
  }>({
    queryKey: ['/api/notifications/settings'],
    queryFn: async () => {
      const res = await authFetch('/api/notifications/settings');
      return res.json();
    },
  });

  const updateNotificationsMutation = useMutation({
    mutationFn: async (settings: { approvedAlerts?: boolean; dailySummary?: boolean; streakReminder?: boolean }) => {
      const res = await authFetch('/api/notifications/settings', {
        method: 'POST',
        body: JSON.stringify(settings),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/settings'] });
      toast({ title: 'Settings saved', soundType: 'success' });
    },
  });

  const addSiteMutation = useMutation({
    mutationFn: async ({ name, url }: { name: string; url: string }) => {
      const res = await authFetch('/api/sites', {
        method: 'POST',
        body: JSON.stringify({ name, url }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sites'] });
      setNewSiteName('');
      setNewSiteUrl('');
      toast({ title: 'Site added!', soundType: 'success' });
    },
    onError: () => {
      toast({ title: 'Failed to add site', variant: 'destructive' });
    },
  });

  const deleteSiteMutation = useMutation({
    mutationFn: async (id: number) => {
      await authFetch(`/api/sites/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sites'] });
      toast({ title: 'Site removed', sound: false });
    },
  });

  const activateSiteMutation = useMutation({
    mutationFn: async (id: number) => {
      await authFetch(`/api/sites/${id}/activate`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sites'] });
      toast({ title: 'Site activated!', soundType: 'success' });
    },
  });

  const addProxiesMutation = useMutation({
    mutationFn: async (proxyList: string[]) => {
      const res = await authFetch('/api/proxies', {
        method: 'POST',
        body: JSON.stringify({ proxies: proxyList }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/proxies'] });
      setNewProxies('');
      setProxyTestResult(null);
      toast({ title: 'Proxies saved!', soundType: 'success' });
    },
  });

  const clearProxiesMutation = useMutation({
    mutationFn: async () => {
      await authFetch('/api/proxies', { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/proxies'] });
      toast({ title: 'All proxies cleared', sound: false });
    },
  });

  const deleteProxyMutation = useMutation({
    mutationFn: async (proxyId: number) => {
      await authFetch(`/api/proxies/${proxyId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/proxies'] });
      toast({ title: 'Proxy deleted', sound: false });
    },
    onError: () => {
      toast({ title: 'Failed to delete proxy', variant: 'destructive' });
    },
  });

  const testProxyMutation = useMutation({
    mutationFn: async (proxy: string) => {
      setTestingProxy(proxy);
      const res = await authFetch('/api/proxies/test', {
        method: 'POST',
        body: JSON.stringify({ proxy }),
      });
      return res.json();
    },
    onSuccess: (data: ProxyTestResult) => {
      setProxyTestResult(data);
      setTestingProxy(null);
      if (data.valid) {
        const speedLabel = data.speed ? `${data.speed}ms` : 'N/A';
        const rotatingLabel = data.isRotating ? 'Rotating' : 'Static';
        toast({ 
          title: 'Proxy Working!', 
          description: `IP: ${data.ip1} | Speed: ${speedLabel} | ${rotatingLabel}`,
          soundType: 'success' 
        });
      } else {
        toast({ 
          title: 'Proxy Failed', 
          description: data.error || 'Connection failed',
          variant: 'destructive' 
        });
      }
    },
    onError: () => {
      setTestingProxy(null);
      setProxyTestResult(null);
      toast({ title: 'Test failed', variant: 'destructive' });
    },
  });

  const handleAddSite = () => {
    if (stats.active) {
      toast({ title: 'Finish current check first', variant: 'destructive' });
      return;
    }
    if (!newSiteName.trim() || !newSiteUrl.trim()) {
      toast({ title: 'Please fill all fields', variant: 'destructive' });
      return;
    }
    addSiteMutation.mutate({ name: newSiteName, url: newSiteUrl });
  };

  const handleTestAndSaveProxies = async () => {
    if (stats.active) {
      toast({ title: 'Finish current check first', variant: 'destructive' });
      return;
    }
    const proxyList = newProxies.split('\n').map(p => p.trim()).filter(p => p);
    if (proxyList.length === 0) {
      toast({ title: 'Enter at least one proxy', variant: 'destructive' });
      return;
    }

    if (proxies.length > 0) {
      toast({ title: 'Only one proxy allowed', description: 'Clear existing proxy first', variant: 'destructive' });
      return;
    }

    if (proxyList.length > 1) {
      toast({ title: 'Only one proxy allowed', variant: 'destructive' });
      return;
    }

    // Test first proxy before saving
    try {
      const testResult = await testProxyMutation.mutateAsync(proxyList[0]);
      if (!testResult.valid) {
        toast({ 
          title: 'Proxy not working', 
          description: 'Test the proxy first and make sure it works',
          variant: 'destructive' 
        });
        return;
      }
      // Only add if test passed
      addProxiesMutation.mutate(proxyList);
    } catch {
      toast({ title: 'Proxy test failed', variant: 'destructive' });
    }
  };

  const handleTestFirstProxy = () => {
    const proxyList = newProxies.split('\n').map(p => p.trim()).filter(p => p);
    if (proxyList.length > 0) {
      testProxyMutation.mutate(proxyList[0]);
    }
  };


  return (
    <div className="min-h-screen bg-background pb-24">
      
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-4 pt-6 pb-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <SettingsIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Settings</h1>
              <p className="text-xs text-muted-foreground">Manage your configuration</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowThemeDropdown(!showThemeDropdown)}
                className="rounded-xl"
                data-testid="button-theme-toggle"
              >
                {(() => {
                  const currentTheme = themeOptions.find(t => t.value === theme);
                  const Icon = currentTheme?.icon || Sun;
                  return <Icon className={`w-5 h-5 ${currentTheme?.color || ''}`} />;
                })()}
              </Button>
              <AnimatePresence>
                {showThemeDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    className="absolute right-0 top-12 z-50 w-48 bg-card border border-border rounded-xl shadow-xl overflow-hidden"
                    data-testid="theme-dropdown"
                  >
                    {themeOptions.map((option) => {
                      const Icon = option.icon;
                      const isActive = theme === option.value;
                      return (
                        <button
                          key={option.value}
                          onClick={() => {
                            setTheme(option.value);
                            setShowThemeDropdown(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/50 ${
                            isActive ? 'bg-primary/10 text-primary' : 'text-foreground'
                          }`}
                          data-testid={`theme-option-${option.value}`}
                        >
                          <Icon className={`w-4 h-4 ${option.color}`} />
                          <span>{option.label}</span>
                          {isActive && (
                            <div className="ml-auto w-2 h-2 rounded-full bg-primary" />
                          )}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {user?.isAdmin && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 dark:bg-amber-500/20 rounded-full"
              >
                <Shield className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-xs font-bold text-amber-600">Admin</span>
              </motion.div>
            )}
          </div>
        </div>
      </motion.header>

      <main className="px-4 space-y-5">
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-5 rounded-3xl bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 shadow-xl shadow-slate-200/20 dark:shadow-none">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center shadow-lg shadow-rose-500/20">
                <Globe className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-lg">Target Sites</h2>
                <p className="text-xs text-slate-400">Add Shopify stores</p>
              </div>
            </div>
            
            <div className="space-y-3 mb-5">
              <Input
                placeholder="Site name (e.g. Nike Store)"
                value={newSiteName}
                onChange={(e) => setNewSiteName(e.target.value)}
                disabled={stats.active}
                className="rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-medium"
                data-testid="input-site-name"
              />
              <Input
                placeholder="https://store.myshopify.com"
                value={newSiteUrl}
                onChange={(e) => setNewSiteUrl(e.target.value)}
                disabled={stats.active}
                className="rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-mono text-sm"
                data-testid="input-site-url"
              />
              <Button 
                onClick={handleAddSite}
                disabled={addSiteMutation.isPending || stats.active}
                className="w-full rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 text-white font-semibold shadow-lg shadow-rose-500/20 border-0"
                size="lg"
                data-testid="button-add-site"
              >
                {addSiteMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-5 h-5 mr-2" />
                    Add Site
                  </>
                )}
              </Button>
            </div>

            <AnimatePresence>
              {sitesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              ) : sites.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-8"
                >
                  <div className="w-16 h-16 mx-auto mb-3 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center">
                    <Globe className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="text-slate-400 text-sm">No sites added yet</p>
                </motion.div>
              ) : (
                <div className="space-y-2">
                  {sites.map((site, index) => (
                    <motion.div
                      key={site.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.05 }}
                      className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                        site.isActive 
                          ? 'border-emerald-300 dark:border-emerald-500/40 bg-gradient-to-r from-emerald-50 to-emerald-100/50 dark:from-emerald-500/10 dark:to-emerald-500/5' 
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'
                      }`}
                      data-testid={`site-item-${site.id}`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {site.isActive && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center"
                          >
                            <Radio className="w-4 h-4 text-emerald-500" />
                          </motion.div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm truncate">{site.name}</p>
                          <p className="text-xs text-slate-400 truncate font-mono">{site.url}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!site.isActive && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => activateSiteMutation.mutate(site.id)}
                            disabled={activateSiteMutation.isPending}
                            className="h-9 w-9 rounded-xl"
                            data-testid={`button-activate-site-${site.id}`}
                          >
                            <CheckCircle className="w-5 h-5 text-emerald-500" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteSiteMutation.mutate(site.id)}
                          className="h-9 w-9 rounded-xl text-rose-500"
                          disabled={deleteSiteMutation.isPending}
                          data-testid={`button-delete-site-${site.id}`}
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="p-5 rounded-3xl bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 shadow-xl shadow-slate-200/20 dark:shadow-none">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <Server className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-lg">Proxy Settings</h2>
                  <p className="text-xs text-slate-400">Test and manage proxies</p>
                </div>
              </div>
              <motion.span 
                key={proxies.length}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                className="text-xs font-bold px-3 py-1.5 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-full"
              >
                {proxies.length} active
              </motion.span>
            </div>
            
            <Textarea
              placeholder="host:port:user:pass&#10;or host:port&#10;One proxy per line"
              value={newProxies}
              onChange={(e) => {
                setNewProxies(e.target.value);
                setProxyTestResult(null);
              }}
              rows={4}
              disabled={stats.active}
              className="font-mono text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 mb-4"
              data-testid="input-proxies"
            />

            <Button 
              onClick={handleTestAndSaveProxies}
              disabled={addProxiesMutation.isPending || testingProxy !== null || !newProxies.trim() || stats.active || proxies.length > 0}
              size="lg"
              className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-0 shadow-lg shadow-indigo-500/20 mb-4"
              data-testid="button-save-proxy"
            >
              {testingProxy || addProxiesMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {testingProxy ? 'Testing...' : 'Saving...'}
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5 mr-2" />
                  Test & Save Proxy
                </>
              )}
            </Button>

            <AnimatePresence>
              {proxyTestResult && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4"
                >
                  <div className={`p-4 rounded-2xl border ${
                    proxyTestResult.valid 
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30' 
                      : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {proxyTestResult.valid ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-rose-500" />
                        )}
                        <span className={`font-bold ${proxyTestResult.valid ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {proxyTestResult.valid ? 'Proxy Active' : 'Proxy Failed'}
                        </span>
                      </div>
                      {proxyTestResult.type && (
                        <span className="text-xs font-medium px-2 py-1 bg-white/50 dark:bg-slate-800/50 rounded-lg">
                          {proxyTestResult.type}
                        </span>
                      )}
                    </div>

                    {proxyTestResult.valid && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-blue-500" />
                            <span className="text-sm">
                              <span className="text-muted-foreground">IP: </span>
                              <span className="font-bold text-blue-600">{proxyTestResult.ip1}</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-amber-500" />
                            <span className="text-sm">
                              <span className="text-muted-foreground">Speed: </span>
                              <span className="font-bold text-amber-600">{proxyTestResult.speed}ms</span>
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex items-center gap-2">
                            <Radio className="w-4 h-4 text-purple-500" />
                            <span className="text-sm">
                              <span className="text-muted-foreground">Type: </span>
                              <span className={`font-bold ${proxyTestResult.isRotating ? 'text-purple-600' : 'text-slate-600'}`}>
                                {proxyTestResult.isRotating ? 'Rotating' : 'Static'}
                              </span>
                            </span>
                          </div>
                          {proxyTestResult.isRotating && proxyTestResult.ip2 && (
                            <div className="flex items-center gap-2">
                              <Wifi className="w-4 h-4 text-emerald-500" />
                              <span className="text-sm">
                                <span className="text-muted-foreground">IP2: </span>
                                <span className="font-bold text-emerald-600">{proxyTestResult.ip2}</span>
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {!proxyTestResult.valid && proxyTestResult.error && (
                      <div className="flex items-center gap-2 text-rose-600">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm">{proxyTestResult.error}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {proxies.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-3"
              >
                {proxies.map((proxy) => (
                  <div 
                    key={proxy.id}
                    className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-500/10 dark:to-purple-500/10 border border-indigo-200 dark:border-indigo-500/30"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-indigo-500" />
                        <span className="font-semibold text-sm text-indigo-600 dark:text-indigo-400">Active Proxy</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setShowFullProxy(showFullProxy === proxy.id ? null : proxy.id)}
                          className="rounded-xl"
                          data-testid={`button-toggle-proxy-${proxy.id}`}
                        >
                          {showFullProxy === proxy.id ? (
                            <EyeOff className="w-4 h-4 text-slate-500" />
                          ) : (
                            <Eye className="w-4 h-4 text-slate-500" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteProxyMutation.mutate(proxy.id)}
                          disabled={deleteProxyMutation.isPending || stats.active}
                          className="rounded-xl text-rose-500"
                          data-testid={`button-delete-proxy-${proxy.id}`}
                        >
                          {deleteProxyMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="font-mono text-xs bg-white/50 dark:bg-slate-800/50 p-2 rounded-lg overflow-hidden">
                      {showFullProxy === proxy.id ? (
                        <span className="break-all">{proxy.proxy}</span>
                      ) : (
                        <span>{proxy.proxy.split(':')[0]}:****:****:****</span>
                      )}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <BinLookup />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="p-5 rounded-2xl border-border bg-card shadow-lg overflow-hidden">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-base">Telegram Notifications</h3>
                <p className="text-xs text-muted-foreground">Manage your alert preferences</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <Label htmlFor="approved-alerts" className="text-sm cursor-pointer">
                    Approved Card Alerts
                  </Label>
                </div>
                <Switch
                  id="approved-alerts"
                  checked={notifSettings?.approvedAlerts ?? true}
                  onCheckedChange={(checked) => updateNotificationsMutation.mutate({ approvedAlerts: checked })}
                  data-testid="switch-approved-alerts"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                <div className="flex items-center gap-3">
                  <Activity className="w-4 h-4 text-blue-500" />
                  <Label htmlFor="daily-summary" className="text-sm cursor-pointer">
                    Daily Summary Report
                  </Label>
                </div>
                <Switch
                  id="daily-summary"
                  checked={notifSettings?.dailySummary ?? false}
                  onCheckedChange={(checked) => updateNotificationsMutation.mutate({ dailySummary: checked })}
                  data-testid="switch-daily-summary"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                <div className="flex items-center gap-3">
                  <Gift className="w-4 h-4 text-purple-500" />
                  <Label htmlFor="streak-reminder" className="text-sm cursor-pointer">
                    Streak Reminder
                  </Label>
                </div>
                <Switch
                  id="streak-reminder"
                  checked={notifSettings?.streakReminder ?? true}
                  onCheckedChange={(checked) => updateNotificationsMutation.mutate({ streakReminder: checked })}
                  data-testid="switch-streak-reminder"
                />
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <Card className="p-5 rounded-2xl border-border bg-card shadow-lg overflow-hidden">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-base">Support & Help</h3>
                <p className="text-xs text-muted-foreground">Need help? Contact us</p>
              </div>
            </div>
            
            <a 
              href="https://t.me/lucee7" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 hover:from-blue-500/20 hover:to-cyan-500/20 transition-all group"
              data-testid="link-contact-owner"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/>
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-bold text-blue-600 dark:text-blue-400 group-hover:underline">@lucee7</p>
                <p className="text-xs text-muted-foreground">Bot Owner - Click to chat</p>
              </div>
              <div className="text-blue-500">
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </a>
            
            <div className="mt-4 p-3 rounded-xl bg-muted/50 border border-border">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Activity className="w-4 h-4 text-emerald-500" />
                <span>App Version: 2.0.0</span>
                <span className="ml-auto text-emerald-500 font-medium">Online</span>
              </div>
            </div>
          </Card>
        </motion.div>

      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-xl border-t border-border px-4 py-3 z-50">
        <div className="flex items-center justify-around max-w-md mx-auto">
          <Link href="/">
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-1.5 py-1 px-6"
              data-testid="nav-home"
            >
              <div className="p-2">
                <HomeIcon className="w-5 h-5 text-muted-foreground" />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground">Home</span>
            </motion.button>
          </Link>
          <Link href="/rewards">
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-1.5 py-1 px-6"
              data-testid="nav-rewards"
            >
              <div className="p-2">
                <Gift className="w-5 h-5 text-muted-foreground" />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground">Rewards</span>
            </motion.button>
          </Link>
          <Link href="/profile">
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-1.5 py-1 px-6"
              data-testid="nav-profile"
            >
              <div className="p-2">
                <User className="w-5 h-5 text-muted-foreground" />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground">Profile</span>
            </motion.button>
          </Link>
          <Link href="/settings">
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-1.5 py-1 px-6"
              data-testid="nav-settings"
            >
              <div className="p-2 rounded-xl bg-purple-500/10">
                <SettingsIcon className="w-5 h-5 text-purple-500" />
              </div>
              <span className="text-[10px] font-semibold text-purple-500">Settings</span>
            </motion.button>
          </Link>
        </div>
      </nav>
    </div>
  );
}
