import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
  ShieldCheck,
  BarChart3,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Coins,
  User,
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
  const [validatingProxy, setValidatingProxy] = useState<string | null>(null);
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
      toast({ title: 'Site added successfully' });
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
      toast({ title: 'Proxies added successfully' });
    },
  });

  const deleteProxyMutation = useMutation({
    mutationFn: async (id: number) => {
      await authFetch(`/api/proxies/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/proxies'] });
      toast({ title: 'Proxy deleted' });
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
      toast({ title: 'Please fill in all fields', variant: 'destructive' });
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
    <div className="min-h-screen bg-gradient-to-b from-background to-background/95">
      <header className="border-b border-border/30 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" className="rounded-full" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-lg font-bold">Settings</h1>
          </div>
          
          <Dialog open={showAnalytics} onOpenChange={setShowAnalytics}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-full" data-testid="button-analytics">
                <BarChart3 className="w-4 h-4 mr-2" />
                Analytics
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm mx-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  Your Statistics
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
                    <TrendingUp className="w-6 h-6 text-green-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-green-500" data-testid="stat-total-charged">
                      {userStats?.totalCharged || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Approved</p>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
                    <TrendingDown className="w-6 h-6 text-red-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-red-500" data-testid="stat-total-declined">
                      {userStats?.totalRejected || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Declined</p>
                  </div>
                </div>
                
                <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Total Checked</span>
                    </div>
                    <span className="font-mono font-bold">{totalChecked}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Success Rate</span>
                    </div>
                    <span className="font-mono font-bold text-primary">{successRate}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Coins className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Credits Balance</span>
                    </div>
                    <span className="font-mono font-bold text-primary">{user?.credits || 0}</span>
                  </div>
                </div>

                {user && (
                  <div className="bg-card border border-border/50 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{user.firstName} {user.lastName}</p>
                        <p className="text-xs text-muted-foreground">@{user.username || user.telegramId}</p>
                      </div>
                      {user.isAdmin && (
                        <Badge className="bg-primary/20 text-primary border-primary/30">
                          Admin
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="w-5 h-5 text-primary" />
              Target Sites
            </CardTitle>
            <CardDescription className="text-xs">
              Add Shopify checkout URLs for validation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Input
                placeholder="Site name"
                value={newSiteName}
                onChange={(e) => setNewSiteName(e.target.value)}
                className="h-10"
                data-testid="input-site-name"
              />
              <Input
                placeholder="https://store.myshopify.com"
                value={newSiteUrl}
                onChange={(e) => setNewSiteUrl(e.target.value)}
                className="h-10"
                data-testid="input-site-url"
              />
              <Button 
                onClick={handleAddSite}
                disabled={addSiteMutation.isPending}
                className="w-full"
                data-testid="button-add-site"
              >
                {addSiteMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Add Site
              </Button>
            </div>

            {sitesLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : sites.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-4">No sites added</p>
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
                        site.isActive ? 'border-primary/50 bg-primary/5' : 'border-border/50 bg-muted/30'
                      }`}
                      data-testid={`site-item-${site.id}`}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {site.isActive && <Radio className="w-4 h-4 text-primary flex-shrink-0" />}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{site.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{site.url}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!site.isActive && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => activateSiteMutation.mutate(site.id)}
                            disabled={activateSiteMutation.isPending}
                            className="h-8 w-8"
                            data-testid={`button-activate-site-${site.id}`}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteSiteMutation.mutate(site.id)}
                          className="h-8 w-8 text-destructive hover:text-destructive"
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
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Server className="w-5 h-5 text-primary" />
              Proxy List
            </CardTitle>
            <CardDescription className="text-xs">
              Format: host:port or host:port:user:pass
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="192.168.1.1:8080&#10;proxy.com:3128:user:pass"
              value={newProxies}
              onChange={(e) => setNewProxies(e.target.value)}
              rows={3}
              className="font-mono text-sm"
              data-testid="input-proxies"
            />
            <div className="flex gap-2">
              <Button 
                onClick={handleAddProxies}
                disabled={addProxiesMutation.isPending}
                className="flex-1"
                data-testid="button-add-proxies"
              >
                {addProxiesMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save
              </Button>
              {proxies.length > 0 && (
                <Button
                  variant="destructive"
                  onClick={() => clearProxiesMutation.mutate()}
                  disabled={clearProxiesMutation.isPending}
                  data-testid="button-clear-proxies"
                >
                  <X className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              )}
            </div>

            {proxiesLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : proxies.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {proxies.length} proxies configured
                </p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {proxies.map((proxy) => (
                    <div
                      key={proxy.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-xs font-mono"
                      data-testid={`proxy-item-${proxy.id}`}
                    >
                      <div className="flex items-center gap-2 truncate flex-1">
                        <ShieldCheck className="w-3 h-3 text-green-500 flex-shrink-0" />
                        <span className="truncate">{proxy.proxy}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteProxyMutation.mutate(proxy.id)}
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      </main>
    </div>
  );
}
