import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
  CreditCard,
  Coins,
  User,
  Home as HomeIcon,
  Settings as SettingsIcon,
  Sparkles,
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
      toast({ title: 'Site added' });
    },
  });

  const deleteSiteMutation = useMutation({
    mutationFn: async (id: number) => {
      await authFetch(`/api/sites/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sites'] });
      toast({ title: 'Site deleted' });
    },
  });

  const activateSiteMutation = useMutation({
    mutationFn: async (id: number) => {
      await authFetch(`/api/sites/${id}/activate`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sites'] });
      toast({ title: 'Site activated' });
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
      toast({ title: 'Proxies saved' });
    },
  });

  const clearProxiesMutation = useMutation({
    mutationFn: async () => {
      await authFetch('/api/proxies', { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/proxies'] });
      toast({ title: 'Proxies cleared' });
    },
  });

  const handleAddSite = () => {
    if (!newSiteName.trim() || !newSiteUrl.trim()) {
      toast({ title: 'Fill all fields', variant: 'destructive' });
      return;
    }
    addSiteMutation.mutate({ name: newSiteName, url: newSiteUrl });
  };

  const handleAddProxies = () => {
    const proxyList = newProxies.split('\n').map(p => p.trim()).filter(p => p);
    if (proxyList.length === 0) {
      toast({ title: 'Enter proxies', variant: 'destructive' });
      return;
    }
    addProxiesMutation.mutate(proxyList);
  };

  const totalChecked = (userStats?.totalCharged || 0) + (userStats?.totalRejected || 0);
  const successRate = totalChecked > 0 ? ((userStats?.totalCharged || 0) / totalChecked * 100).toFixed(1) : '0.0';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-pink-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-20">
      
      <header className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-pink-400" />
            <h1 className="text-lg font-bold">Settings</h1>
          </div>
          
          <Dialog open={showAnalytics} onOpenChange={setShowAnalytics}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full" data-testid="button-analytics">
                <BarChart3 className="w-5 h-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xs mx-auto rounded-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-center justify-center">
                  <BarChart3 className="w-5 h-5 text-rose-500" />
                  Statistics
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-4 text-center">
                    <TrendingUp className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400" data-testid="stat-total-charged">
                      {userStats?.totalCharged || 0}
                    </p>
                    <p className="text-xs text-slate-500">Approved</p>
                  </div>
                  <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl p-4 text-center">
                    <TrendingDown className="w-6 h-6 text-rose-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-rose-600 dark:text-rose-400" data-testid="stat-total-declined">
                      {userStats?.totalRejected || 0}
                    </p>
                    <p className="text-xs text-slate-500">Declined</p>
                  </div>
                </div>
                
                <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Total Checked</span>
                    <span className="font-mono font-bold">{totalChecked}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Success Rate</span>
                    <span className="font-mono font-bold text-emerald-600">{successRate}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Credits</span>
                    <span className="font-mono font-bold text-emerald-600">{user?.credits || 0}</span>
                  </div>
                </div>

                {user && (
                  <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center text-white font-bold">
                        {(user.firstName?.[0] || user.username?.[0] || 'U').toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{user.firstName} {user.lastName}</p>
                        <p className="text-xs text-slate-400">@{user.username || user.telegramId}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="px-4 space-y-4">
        
        <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/50 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-5 h-5 text-rose-500" />
            <h2 className="font-semibold">Target Sites</h2>
          </div>
          
          <div className="space-y-3 mb-4">
            <Input
              placeholder="Site name"
              value={newSiteName}
              onChange={(e) => setNewSiteName(e.target.value)}
              className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              data-testid="input-site-name"
            />
            <Input
              placeholder="https://store.myshopify.com"
              value={newSiteUrl}
              onChange={(e) => setNewSiteUrl(e.target.value)}
              className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              data-testid="input-site-url"
            />
            <Button 
              onClick={handleAddSite}
              disabled={addSiteMutation.isPending}
              className="w-full h-11 rounded-xl bg-slate-800 dark:bg-slate-700"
              data-testid="button-add-site"
            >
              {addSiteMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Site
                </>
              )}
            </Button>
          </div>

          {sitesLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : sites.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-4">No sites added</p>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {sites.map((site) => (
                  <motion.div
                    key={site.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className={`flex items-center justify-between p-3 rounded-xl border ${
                      site.isActive 
                        ? 'border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/5' 
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'
                    }`}
                    data-testid={`site-item-${site.id}`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {site.isActive && <Radio className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{site.name}</p>
                        <p className="text-xs text-slate-400 truncate">{site.url}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!site.isActive && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => activateSiteMutation.mutate(site.id)}
                          disabled={activateSiteMutation.isPending}
                          className="h-8 w-8 rounded-lg"
                          data-testid={`button-activate-site-${site.id}`}
                        >
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteSiteMutation.mutate(site.id)}
                        className="h-8 w-8 rounded-lg text-rose-500"
                        disabled={deleteSiteMutation.isPending}
                        data-testid={`button-delete-site-${site.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/50 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <Server className="w-5 h-5 text-rose-500" />
            <h2 className="font-semibold">Proxy List</h2>
            <span className="text-xs text-slate-400 ml-auto">{proxies.length} active</span>
          </div>
          
          <Textarea
            placeholder="host:port:user:pass&#10;or host:port"
            value={newProxies}
            onChange={(e) => setNewProxies(e.target.value)}
            rows={3}
            className="font-mono text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 mb-3"
            data-testid="input-proxies"
          />
          <div className="flex gap-2">
            <Button 
              onClick={handleAddProxies}
              disabled={addProxiesMutation.isPending}
              className="flex-1 h-10 rounded-xl bg-slate-800 dark:bg-slate-700"
              data-testid="button-add-proxies"
            >
              {addProxiesMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </>
              )}
            </Button>
            {proxies.length > 0 && (
              <Button
                variant="outline"
                onClick={() => clearProxiesMutation.mutate()}
                disabled={clearProxiesMutation.isPending}
                className="h-10 rounded-xl border-rose-300 text-rose-500"
                data-testid="button-clear-proxies"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-700/50 px-4 py-2 z-50">
        <div className="flex items-center justify-around max-w-md mx-auto">
          <Link href="/">
            <button className="flex flex-col items-center gap-1 py-2 px-6 text-slate-400">
              <HomeIcon className="w-5 h-5" />
              <span className="text-[10px] font-medium">Home</span>
            </button>
          </Link>
          <button className="flex flex-col items-center gap-1 py-2 px-6 text-slate-400">
            <User className="w-5 h-5" />
            <span className="text-[10px] font-medium">Profile</span>
          </button>
          <Link href="/settings">
            <button className="flex flex-col items-center gap-1 py-2 px-6 text-rose-500">
              <SettingsIcon className="w-5 h-5" />
              <span className="text-[10px] font-medium">Settings</span>
            </button>
          </Link>
        </div>
      </nav>

    </div>
  );
}
