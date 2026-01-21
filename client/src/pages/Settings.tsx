import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { authFetch } from '@/lib/auth';
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
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteUrl, setNewSiteUrl] = useState('');
  const [newProxies, setNewProxies] = useState('');
  const [validatingProxy, setValidatingProxy] = useState<string | null>(null);

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

  const validateProxy = async (proxy: string) => {
    setValidatingProxy(proxy);
    try {
      const res = await authFetch('/api/proxies/validate', {
        method: 'POST',
        body: JSON.stringify({ proxy }),
      });
      const data = await res.json();
      toast({
        title: data.valid ? 'Proxy is valid' : 'Proxy is invalid',
        variant: data.valid ? 'default' : 'destructive',
      });
    } catch {
      toast({ title: 'Validation failed', variant: 'destructive' });
    }
    setValidatingProxy(null);
  };

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

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-orbitron text-foreground">Settings</h1>
            <p className="text-muted-foreground text-sm">Manage sites and proxies</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              Target Sites
            </CardTitle>
            <CardDescription>
              Add Shopify sites for card checking. Set one as active.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                placeholder="Site name (e.g., Store 1)"
                value={newSiteName}
                onChange={(e) => setNewSiteName(e.target.value)}
                data-testid="input-site-name"
              />
              <Input
                placeholder="https://example.com"
                value={newSiteUrl}
                onChange={(e) => setNewSiteUrl(e.target.value)}
                data-testid="input-site-url"
              />
              <Button 
                onClick={handleAddSite}
                disabled={addSiteMutation.isPending}
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
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : sites.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No sites added yet</p>
            ) : (
              <div className="space-y-2">
                <AnimatePresence>
                  {sites.map((site) => (
                    <motion.div
                      key={site.id}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        site.isActive ? 'border-primary bg-primary/5' : 'border-border'
                      }`}
                      data-testid={`site-item-${site.id}`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {site.isActive && (
                          <Radio className="w-4 h-4 text-primary flex-shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{site.name}</span>
                            {site.isActive && (
                              <Badge variant="outline" className="text-xs text-primary border-primary">
                                Active
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{site.url}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!site.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => activateSiteMutation.mutate(site.id)}
                            disabled={activateSiteMutation.isPending}
                            data-testid={`button-activate-site-${site.id}`}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteSiteMutation.mutate(site.id)}
                          className="text-destructive hover:text-destructive"
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5 text-primary" />
              Proxy List
            </CardTitle>
            <CardDescription>
              Add rotating proxies. Format: host:port:user:pass or host:port
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="192.168.1.1:8080:user:pass&#10;proxy.example.com:3128"
              value={newProxies}
              onChange={(e) => setNewProxies(e.target.value)}
              rows={4}
              className="font-mono text-sm"
              data-testid="input-proxies"
            />
            <div className="flex gap-2">
              <Button 
                onClick={handleAddProxies}
                disabled={addProxiesMutation.isPending}
                data-testid="button-add-proxies"
              >
                {addProxiesMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Proxies
              </Button>
              {proxies.length > 0 && (
                <Button
                  variant="destructive"
                  onClick={() => clearProxiesMutation.mutate()}
                  disabled={clearProxiesMutation.isPending}
                  data-testid="button-clear-proxies"
                >
                  <X className="w-4 h-4 mr-2" />
                  Clear All
                </Button>
              )}
            </div>

            {proxiesLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : proxies.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {proxies.length} proxies configured
                  </span>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {proxies.map((proxy) => (
                    <div
                      key={proxy.id}
                      className="flex items-center justify-between p-2 rounded bg-muted/50 text-sm font-mono"
                      data-testid={`proxy-item-${proxy.id}`}
                    >
                      <div className="flex items-center gap-2 truncate flex-1">
                        {proxy.isValid ? (
                          <ShieldCheck className="w-4 h-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <X className="w-4 h-4 text-destructive flex-shrink-0" />
                        )}
                        <span className="truncate">{proxy.proxy}</span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => validateProxy(proxy.proxy)}
                          disabled={validatingProxy === proxy.proxy}
                        >
                          {validatingProxy === proxy.proxy ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <CheckCircle className="w-3 h-3" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteProxyMutation.mutate(proxy.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
