import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { Search, CreditCard, Building2, Globe, Loader2, AlertCircle, CheckCircle2, Wallet } from "lucide-react";

interface BinData {
  bin: string;
  scheme: string;
  type: string;
  brand: string;
  prepaid: boolean;
  country: {
    name: string;
    code: string;
    emoji: string;
  };
  bank: {
    name: string;
    url: string;
    phone: string;
    city: string;
  };
}

export function BinLookup() {
  const [binInput, setBinInput] = useState("");

  const lookupMutation = useMutation({
    mutationFn: async (bin: string) => {
      const res = await apiRequest("GET", `/api/bin/${bin}`);
      const data = await res.json() as BinData;
      if (!data.scheme && !data.type && !data.country?.name && !data.bank?.name) {
        throw new Error("BIN not found in database");
      }
      return data;
    },
  });

  const handleLookup = () => {
    const cleanBin = binInput.replace(/\D/g, '').slice(0, 6);
    if (cleanBin.length >= 6) {
      lookupMutation.mutate(cleanBin);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLookup();
    }
  };

  const getCountryFlag = (countryCode: string) => {
    if (!countryCode || countryCode === 'XX') return '';
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  const getSchemeColor = (scheme: string) => {
    const colors: { [key: string]: string } = {
      visa: "bg-gradient-to-r from-blue-500 to-blue-600",
      mastercard: "bg-gradient-to-r from-orange-500 to-red-500",
      amex: "bg-gradient-to-r from-blue-400 to-blue-600",
      discover: "bg-gradient-to-r from-orange-500 to-orange-600",
      jcb: "bg-gradient-to-r from-green-500 to-emerald-600",
      unionpay: "bg-gradient-to-r from-red-500 to-red-600",
      diners: "bg-gradient-to-r from-blue-600 to-indigo-600",
    };
    return colors[scheme?.toLowerCase()] || "bg-gradient-to-r from-purple-500 to-purple-600";
  };

  const getTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      credit: "bg-emerald-500/20 text-emerald-600 border-emerald-500/30",
      debit: "bg-blue-500/20 text-blue-600 border-blue-500/30",
      prepaid: "bg-amber-500/20 text-amber-600 border-amber-500/30",
    };
    return colors[type?.toLowerCase()] || "bg-gray-500/20 text-gray-600 border-gray-500/30";
  };

  return (
    <Card data-testid="bin-lookup-card" className="overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-purple-500/5 to-pink-500/5">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="p-1.5 rounded-lg bg-purple-500/10">
            <CreditCard className="w-4 h-4 text-purple-500" />
          </div>
          BIN Lookup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              placeholder="Enter first 6 digits..."
              value={binInput}
              onChange={(e) => setBinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyPress={handleKeyPress}
              className="font-mono text-lg tracking-wider pl-4 pr-12"
              maxLength={6}
              data-testid="input-bin"
            />
            {binInput.length > 0 && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {binInput.length}/6
              </span>
            )}
          </div>
          <Button
            onClick={handleLookup}
            disabled={binInput.length < 6 || lookupMutation.isPending}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            data-testid="button-bin-lookup"
          >
            {lookupMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Search className="w-4 h-4 mr-1" />
                Search
              </>
            )}
          </Button>
        </div>

        <AnimatePresence mode="wait">
          {lookupMutation.isError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20"
            >
              <AlertCircle className="w-4 h-4 text-destructive" />
              <span className="text-sm text-destructive">BIN not found in database. Try a different card number.</span>
            </motion.div>
          )}

          {lookupMutation.data && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
              data-testid="bin-result"
            >
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-600 font-medium">BIN Found</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge className={`${getSchemeColor(lookupMutation.data.scheme)} text-white border-0 px-3 py-1`}>
                  {lookupMutation.data.scheme?.toUpperCase() || "UNKNOWN"}
                </Badge>
                <Badge className={`${getTypeColor(lookupMutation.data.type)} border px-3 py-1`}>
                  {lookupMutation.data.type?.toUpperCase() || "UNKNOWN"}
                </Badge>
                {lookupMutation.data.prepaid && (
                  <Badge className="bg-amber-500/20 text-amber-600 border border-amber-500/30 px-3 py-1">
                    <Wallet className="w-3 h-3 mr-1" />
                    PREPAID
                  </Badge>
                )}
              </div>

              <div className="grid gap-2 text-sm">
                {lookupMutation.data.country?.name && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50"
                  >
                    <Globe className="w-4 h-4 text-blue-500" />
                    <span className="text-muted-foreground">Country:</span>
                    <span className="font-medium flex items-center gap-2 ml-auto">
                      <span className="text-xl">{lookupMutation.data.country.emoji || getCountryFlag(lookupMutation.data.country.code)}</span>
                      {lookupMutation.data.country.name}
                    </span>
                  </motion.div>
                )}

                {lookupMutation.data.bank?.name && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50"
                  >
                    <Building2 className="w-4 h-4 text-purple-500" />
                    <span className="text-muted-foreground">Bank:</span>
                    <span className="font-medium truncate ml-auto max-w-[60%] text-right">
                      {lookupMutation.data.bank.name}
                    </span>
                  </motion.div>
                )}

                {lookupMutation.data.brand && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50"
                  >
                    <CreditCard className="w-4 h-4 text-pink-500" />
                    <span className="text-muted-foreground">Brand:</span>
                    <span className="font-medium ml-auto">{lookupMutation.data.brand}</span>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}