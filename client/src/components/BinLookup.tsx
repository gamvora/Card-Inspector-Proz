import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { Search, CreditCard, Building2, Globe, Loader2 } from "lucide-react";

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
      return res.json() as Promise<BinData>;
    },
  });

  const handleLookup = () => {
    const cleanBin = binInput.replace(/\D/g, '').slice(0, 6);
    if (cleanBin.length >= 6) {
      lookupMutation.mutate(cleanBin);
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
      visa: "bg-blue-500",
      mastercard: "bg-orange-500",
      amex: "bg-green-500",
      discover: "bg-orange-600",
      jcb: "bg-red-500",
      unionpay: "bg-red-600",
      diners: "bg-gray-500",
    };
    return colors[scheme?.toLowerCase()] || "bg-purple-500";
  };

  return (
    <Card data-testid="bin-lookup-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="w-4 h-4 text-purple-500" />
          BIN Lookup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Enter first 6 digits..."
            value={binInput}
            onChange={(e) => setBinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="font-mono"
            maxLength={6}
            data-testid="input-bin"
          />
          <Button
            onClick={handleLookup}
            disabled={binInput.length < 6 || lookupMutation.isPending}
            size="icon"
            data-testid="button-bin-lookup"
          >
            {lookupMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </Button>
        </div>

        <AnimatePresence mode="wait">
          {lookupMutation.isError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-sm text-destructive text-center py-2"
            >
              BIN not found or invalid
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className={getSchemeColor(lookupMutation.data.scheme)}>
                    {lookupMutation.data.scheme?.toUpperCase() || "UNKNOWN"}
                  </Badge>
                  <Badge variant="outline">
                    {lookupMutation.data.type?.toUpperCase() || "UNKNOWN"}
                  </Badge>
                  {lookupMutation.data.prepaid && (
                    <Badge variant="secondary">PREPAID</Badge>
                  )}
                </div>
              </div>

              <div className="grid gap-2 text-sm">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Country:</span>
                  <span className="font-medium flex items-center gap-1">
                    <span className="text-lg">{getCountryFlag(lookupMutation.data.country.code)}</span>
                    {lookupMutation.data.country.name}
                  </span>
                </div>

                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Bank:</span>
                  <span className="font-medium truncate">
                    {lookupMutation.data.bank.name || "Unknown"}
                  </span>
                </div>

                {lookupMutation.data.brand && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <CreditCard className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Brand:</span>
                    <span className="font-medium">{lookupMutation.data.brand}</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}