/**
 * Jupiter V6 API Integration
 * 
 * Wrapper for Jupiter swap API with optional Ultra features.
 */
import { z } from 'zod';

export interface JupiterConfig {
  apiKey?: string;
  endpoint: string;
  useUltra: boolean;
}

const DEFAULT_CONFIG: JupiterConfig = {
  endpoint: 'https://quote-api.jup.ag/v6',
  useUltra: true,
};

// Zod schemas for Jupiter API validation
export const JupiterQuoteSchema = z.object({
  inputMint: z.string(),
  inAmount: z.string(),
  outputMint: z.string(),
  outAmount: z.string(),
  otherAmountThreshold: z.string(),
  swapMode: z.enum(['ExactIn', 'ExactOut']),
  slippageBps: z.number(),
  priceImpactPct: z.string(),
  routePlan: z.array(z.object({
    swapInfo: z.object({
      ammKey: z.string(),
      label: z.string(),
      inputMint: z.string(),
      outputMint: z.string(),
      inAmount: z.string(),
      outAmount: z.string(),
      feeAmount: z.string(),
      feeMint: z.string(),
    }),
    percent: z.number(),
  })),
  contextSlot: z.number().optional(),
  timeTaken: z.number().optional(),
}).passthrough();

export const SwapTransactionSchema = z.object({
  swapTransaction: z.string(),
  lastValidBlockHeight: z.number(),
  prioritizationFeeLamports: z.number().optional(),
}).passthrough();

export type JupiterQuote = z.infer<typeof JupiterQuoteSchema>;
export type SwapTransaction = z.infer<typeof SwapTransactionSchema>;

export class JupiterTool {
  private config: JupiterConfig;

  constructor(config: Partial<JupiterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    // Remove trailing slash from endpoint if present
    if (this.config.endpoint.endsWith('/')) {
      this.config.endpoint = this.config.endpoint.slice(0, -1);
    }
  }

  /**
   * Get swap quote from Jupiter
   */
  async getQuote(params: {
    inputMint: string;
    outputMint: string;
    amount: string;
    slippageBps?: number;
    swapMode?: 'ExactIn' | 'ExactOut';
  }): Promise<JupiterQuote> {
    const url = new URL(`${this.config.endpoint}/quote`);
    url.searchParams.append('inputMint', params.inputMint);
    url.searchParams.append('outputMint', params.outputMint);
    url.searchParams.append('amount', params.amount);
    
    if (params.slippageBps !== undefined) {
      url.searchParams.append('slippageBps', params.slippageBps.toString());
    }
    
    if (params.swapMode) {
      url.searchParams.append('swapMode', params.swapMode);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers['x-api-key'] = this.config.apiKey;
    }

    try {
      const response = await fetch(url.toString(), { headers });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Jupiter Quote API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const rawData = await response.json();
      return JupiterQuoteSchema.parse(rawData);
    } catch (error) {
      console.error('Error fetching quote from Jupiter:', error);
      throw error;
    }
  }

  /**
   * Execute swap via Jupiter (builds transaction)
   */
  async executeSwap(params: {
    quote: JupiterQuote;
    userPublicKey: string;
    wrapAndUnwrapSol?: boolean;
    useSharedAccounts?: boolean;
    prioritizationFeeLamports?: number | 'auto';
  }): Promise<SwapTransaction> {
    const url = `${this.config.endpoint}/swap`;

    const body: any = {
      quoteResponse: params.quote,
      userPublicKey: params.userPublicKey,
      wrapAndUnwrapSol: params.wrapAndUnwrapSol ?? true,
      useSharedAccounts: params.useSharedAccounts ?? true,
    };

    if (params.prioritizationFeeLamports) {
      body.prioritizationFeeLamports = params.prioritizationFeeLamports;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers['x-api-key'] = this.config.apiKey;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Jupiter Swap API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const rawData = await response.json();
      return SwapTransactionSchema.parse(rawData);
    } catch (error) {
      console.error('Error executing swap on Jupiter:', error);
      throw error;
    }
  }
}
