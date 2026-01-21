import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { authFetch } from '@/lib/auth';
import { useAuth } from '@/lib/auth';
import { 
  Globe, 
  Plus, 
  Trash2, 
  CheckCircle, 
  Loader2, 
  Server,
  Save,
  X,
  ArrowLeft,
  Radio,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Coins,
  Home as HomeIcon,
  User,
  Settings as SettingsIcon,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Link } from 'wouter';

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

export default function Settings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteUrl, setNewSiteUrl] = useState('');
  const [newProxies, setNewProxies] = useState('');
  const [showAnalytics, setShowAnalytics] = useState(false);

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

  const { data: userStats } = useQuery({
    queryKey: ['/api/stats'],
    queryFn: async () => {
      const res = await authFetch('/api/stats');
      if (!res.ok) return null;
      return res.json();
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
      toast({ title: 'Site added successfully!' });
    },
  });

  const deleteSiteMutation = useMutation({
    mutationFn: async (id: number) => {
      await authFetch(`/api/sites/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sites'] });
      toast({ title: 'Site removed' });
    },
  });

  const activateSiteMutation = useMutation({
    mutationFn: async (id: number) => {
      await authFetch(`/api/sites/${id}/activate`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sites'] });
      toast({ title: 'Site activated!' });
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
      toast({ title: 'Proxies saved!' });
    },
  });

  const clearProxiesMutation = useMutation({
    mutationFn: async () => {
      await authFetch('/api/proxies', { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/proxies'] });
      toast({ title: 'All proxies cleared' });
    },
  });

  const handleAddSite = () => {
    if (!newSiteName.trim() || !newSiteUrl.trim()) {
      toast({ title: 'Please fill all fields', variant: 'destructive' });
      return;
    }
    addSiteMutation.mutate({ name: newSiteName, url: newSiteUrl });
  };

  const handleAddProxies = () => {
    const proxyList = newProxies.split('\n').map(p => p.trim()).filter(p => p);
    if (proxyList.length === 0) {
      toast({ title: 'Please enter at least one proxy', variant: 'destructive' });
      return;
    }
    addProxiesMutation.mutate(proxyList);
  };

  const totalChecked = (userStats?.totalCharged || 0) + (userStats?.totalRejected || 0);
  const successRate = totalChecked > 0 ? ((userStats?.totalCharged || 0) / totalChecked * 100).toFixed(1) : '0.0';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-20">
      
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-4 pt-4 pb-2"
      >
        <div className="flex items-center justify-between mb-4">
          <Link href="/">
            <motion.div whileTap={{ scale: 0.95 }}>
              <Button variant="ghost" size="icon" className="rounded-full" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </motion.div>
          </Link>
          
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              <Sparkles className="w-5 h-5 text-purple-400" />
            </motion.div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">Settings</h1>
          </div>
          
          <Dialog open={showAnalytics} onOpenChange={setShowAnalytics}>
            <DialogTrigger asChild>
              <motion.div whileTap={{ scale: 0.95 }}>
                <Button variant="ghost" size="icon" className="rounded-full" data-testid="button-analytics">
                  <BarChart3 className="w-5 h-5" />
                </Button>
              </motion.div>
            </DialogTrigger>
            <DialogContent className="max-w-xs mx-auto rounded-3xl border-0 shadow-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-center justify-center">
                  <Zap className="w-5 h-5 text-amber-500" />
                  Your Statistics
                </DialogTitle>
                <DialogDescription className="text-center text-xs">
                  Track your checking performance
                </DialogDescription>
              </DialogHeader>
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4 pt-2"
              >
                <div className="grid grid-cols-2 gap-3">
                  <motion.div 
                    whileHover={{ scale: 1.02 }}
                    className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-500/20 dark:to-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl p-4 text-center"
                  >
                    <div className="w-10 h-10 mx-auto mb-2 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-emerald-600" />
                    </div>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400" data-testid="stat-total-charged">
                      {userStats?.totalCharged || 0}
                    </p>
                    <p className="text-xs font-medium text-emerald-600/70">Approved</p>
                  </motion.div>
                  <motion.div 
                    whileHover={{ scale: 1.02 }}
                    className="bg-gradient-to-br from-rose-50 to-rose-100/50 dark:from-rose-500/20 dark:to-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-2xl p-4 text-center"
                  >
                    <div className="w-10 h-10 mx-auto mb-2 bg-rose-500/20 rounded-xl flex items-center justify-center">
                      <TrendingDown className="w-5 h-5 text-rose-600" />
                    </div>
                    <p className="text-2xl font-bold text-rose-600 dark:text-rose-400" data-testid="stat-total-declined">
                      {userStats?.totalRejected || 0}
                    </p>
                    <p className="text-xs font-medium text-rose-600/70">Declined</p>
                  </motion.div>
                </div>
                
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-800/50 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500 font-medium">Total Checked</span>
                    <span className="font-mono font-bold text-lg">{totalChecked}</span>
                  </div>
                  <div className="h-px bg-slate-200 dark:bg-slate-700" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500 font-medium">Success Rate</span>
                    <span className="font-mono font-bold text-lg text-emerald-600">{successRate}%</span>
                  </div>
                  <div className="h-px bg-slate-200 dark:bg-slate-700" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500 font-medium">Credits</span>
                    <div className="flex items-center gap-1">
                      <Coins className="w-4 h-4 text-amber-500" />
                      <span className="font-mono font-bold text-lg text-amber-600">{user?.credits || 0}</span>
                    </div>
                  </div>
                </motion.div>

                {user && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-400 via-pink-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-pink-500/20">
                        {(user.firstName?.[0] || user.username?.[0] || 'U').toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{user.firstName} {user.lastName}</p>
                        <p className="text-xs text-slate-400">@{user.username || user.telegramId}</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            </DialogContent>
          </Dialog>
        </div>
      </motion.header>

      <main className="px-4 space-y-4">
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200/80 dark:border-slate-700/50 shadow-lg shadow-slate-200/30 dark:shadow-none p-5"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Target Sites</h2>
              <p className="text-xs text-slate-400">Add Shopify stores to check</p>
            </div>
          </div>
          
          <div className="space-y-3 mb-5">
            <Input
              placeholder="Site name (e.g. Nike Store)"
              value={newSiteName}
              onChange={(e) => setNewSiteName(e.target.value)}
              className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-medium"
              data-testid="input-site-name"
            />
            <Input
              placeholder="https://store.myshopify.com"
              value={newSiteUrl}
              onChange={(e) => setNewSiteUrl(e.target.value)}
              className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-mono text-sm"
              data-testid="input-site-url"
            />
            <Button 
              onClick={handleAddSite}
              disabled={addSiteMutation.isPending}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 text-white font-semibold shadow-lg shadow-rose-500/20"
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

          {sitesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : sites.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-3 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center">
                <Globe className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-400 text-sm">No sites added yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
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
                        <motion.div whileTap={{ scale: 0.9 }}>
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
                        </motion.div>
                      )}
                      <motion.div whileTap={{ scale: 0.9 }}>
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
                      </motion.div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200/80 dark:border-slate-700/50 shadow-lg shadow-slate-200/30 dark:shadow-none p-5"
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center">
                <Server className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-lg">Proxy List</h2>
                <p className="text-xs text-slate-400">Add proxies for rotation</p>
              </div>
            </div>
            <motion.span 
              key={proxies.length}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              className="text-xs font-bold px-3 py-1 bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-full"
            >
              {proxies.length} active
            </motion.span>
          </div>
          
          <Textarea
            placeholder="host:port:user:pass&#10;or host:port&#10;One proxy per line"
            value={newProxies}
            onChange={(e) => setNewProxies(e.target.value)}
            rows={4}
            className="font-mono text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 mb-4"
            data-testid="input-proxies"
          />
          <div className="flex gap-3">
            <Button 
              onClick={handleAddProxies}
              disabled={addProxiesMutation.isPending}
              className="flex-1 h-12 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-semibold shadow-lg shadow-purple-500/20"
              data-testid="button-add-proxies"
            >
              {addProxiesMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  Save Proxies
                </>
              )}
            </Button>
            {proxies.length > 0 && (
              <motion.div whileTap={{ scale: 0.95 }}>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => clearProxiesMutation.mutate()}
                  disabled={clearProxiesMutation.isPending}
                  className="h-12 w-12 rounded-xl border-2 border-rose-300 dark:border-rose-500/50 text-rose-500"
                  data-testid="button-clear-proxies"
                >
                  {clearProxiesMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <X className="w-5 h-5" />
                  )}
                </Button>
              </motion.div>
            )}
          </div>
        </motion.div>

      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-700/50 px-4 py-3 z-50">
        <div className="flex items-center justify-around max-w-md mx-auto">
          <Link href="/">
            <motion.button 
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-1.5 py-1 px-8"
            >
              <div className="p-2">
                <HomeIcon className="w-5 h-5 text-slate-400" />
              </div>
              <span className="text-[10px] font-medium text-slate-400">Home</span>
            </motion.button>
          </Link>
          <motion.button 
            whileTap={{ scale: 0.95 }}
            className="flex flex-col items-center gap-1.5 py-1 px-8"
          >
            <div className="p-2">
              <User className="w-5 h-5 text-slate-400" />
            </div>
            <span className="text-[10px] font-medium text-slate-400">Profile</span>
          </motion.button>
          <Link href="/settings">
            <motion.button 
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-1.5 py-1 px-8"
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
