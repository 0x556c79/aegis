/**
 * TRADER Agent - Execution
 * 
 * Builds and executes swaps via Jupiter Ultra API.
 * Manages slippage, MEV protection, and transaction optimization.
 */

import { z } from 'zod';
import { JupiterTool, JupiterQuote, SwapTransaction as JupiterSwapTransaction } from '../tools/jupiter';

export const TraderConfigSchema = z.object({
  defaultSlippage: z.number().min(0).max(50).default(0.5), // percentage
  maxSlippage: z.number().min(0).max(50).default(3),
  useJupiterUltra: z.boolean().default(true),
  priorityFee: z.enum(['low', 'medium', 'high', 'auto']).default('auto'),
  jupiterEndpoint: z.string().default('https://quote-api.jup.ag/v6'),
  jupiterApiKey: z.string().optional(),
});

export type TraderConfig = z.infer<typeof TraderConfigSchema>;

export class Trader {
  private config: TraderConfig;
  private jupiter: JupiterTool;

  constructor(config: Partial<TraderConfig> = {}) {
    this.config = TraderConfigSchema.parse(config);
    this.jupiter = new JupiterTool({
      endpoint: this.config.jupiterEndpoint,
      apiKey: this.config.jupiterApiKey,
      useUltra: this.config.useJupiterUltra,
    });
  }

  /**
   * Get a quote for a swap
   */
  async getQuote(params: QuoteRequest): Promise<Quote> {
    const slippageBps = Math.floor(this.config.defaultSlippage * 100);
    
    try {
      const quote = await this.jupiter.getQuote({
        inputMint: params.inputMint,
        outputMint: params.outputMint,
        amount: params.amount.toString(),
        slippageBps,
        swapMode: params.type === 'exactIn' ? 'ExactIn' : 'ExactOut',
      });

      return this.mapJupiterQuoteToQuote(quote, params);
    } catch (error) {
      console.error('Failed to get quote:', error);
      throw error;
    }
  }

  /**
   * Execute a swap
   */
  async executeSwap(quote: Quote, userPublicKey: string, signer?: (tx: string) => Promise<string>): Promise<SwapResult> {
    if (!quote.providerQuote) {
      throw new Error('Invalid quote: missing provider data');
    }

    try {
      const builtTx = await this.buildTransaction({
        type: 'swap',
        details: {
          quote,
          userPublicKey,
        },
      });

      if (!signer) {
        // If no signer provided, return success false but provide the built transaction
        // This allows the caller to handle signing (e.g. frontend)
        return {
          success: false,
          inputAmount: quote.inputAmount,
          outputAmount: quote.outputAmount,
          fee: quote.fee,
          error: 'No signer provided',
          data: { transaction: builtTx.serialized }
        };
      }

      const signature = await signer(builtTx.serialized);

      return {
        success: true,
        signature,
        inputAmount: quote.inputAmount,
        outputAmount: quote.outputAmount,
        fee: quote.fee,
      };

    } catch (error: any) {
      return {
        success: false,
        inputAmount: quote.inputAmount,
        outputAmount: quote.outputAmount,
        fee: quote.fee,
        error: error.message || 'Swap failed',
      };
    }
  }

  /**
   * Build an optimized transaction
   */
  async buildTransaction(params: TransactionParams): Promise<BuiltTransaction> {
    if (params.type !== 'swap') {
      throw new Error(`Transaction type ${params.type} not supported`);
    }

    const { quote, userPublicKey } = params.details as { quote: Quote; userPublicKey: string };
    
    if (!quote || !userPublicKey) {
      throw new Error('Missing quote or userPublicKey for swap transaction');
    }

    const swapTx = await this.jupiter.executeSwap({
      quote: quote.providerQuote as JupiterQuote,
      userPublicKey,
      prioritizationFeeLamports: this.config.priorityFee === 'auto' ? undefined : 1000, // Simple mapping for now
    });

    return {
      serialized: swapTx.swapTransaction,
      estimatedFee: swapTx.prioritizationFeeLamports || 5000, // Default to 5000 if not provided
      expiresAt: new Date(Date.now() + 60000), // 1 minute expiry estimate
    };
  }

  private mapJupiterQuoteToQuote(jupQuote: JupiterQuote, request: QuoteRequest): Quote {
    return {
      id: Math.random().toString(36).substring(7), // Generate a temp ID
      inputMint: jupQuote.inputMint,
      outputMint: jupQuote.outputMint,
      inputAmount: BigInt(jupQuote.inAmount),
      outputAmount: BigInt(jupQuote.outAmount),
      priceImpact: parseFloat(jupQuote.priceImpactPct) * 100, // Convert decimal to percentage
      route: jupQuote.routePlan.map(step => ({
        protocol: step.swapInfo.label,
        poolAddress: step.swapInfo.ammKey,
        inputMint: step.swapInfo.inputMint,
        outputMint: step.swapInfo.outputMint,
        percentage: step.percent,
      })),
      fee: 0, // Jupiter V6 quote doesn't strictly return total fee in a simple way, usually included in outAmount or platform fee
      expiresAt: new Date(Date.now() + 30000), // 30s validity
      providerQuote: jupQuote,
    };
  }
}

// Type definitions
export interface QuoteRequest {
  inputMint: string;
  outputMint: string;
  amount: bigint;
  type: 'exactIn' | 'exactOut';
}

export interface Quote {
  id: string;
  inputMint: string;
  outputMint: string;
  inputAmount: bigint;
  outputAmount: bigint;
  priceImpact: number;
  route: RouteStep[];
  fee: number;
  expiresAt: Date;
  providerQuote?: unknown; // Store raw provider quote
}

export interface RouteStep {
  protocol: string;
  poolAddress: string;
  inputMint: string;
  outputMint: string;
  percentage: number;
}

export interface SwapResult {
  success: boolean;
  signature?: string;
  inputAmount: bigint;
  outputAmount: bigint;
  fee: number;
  error?: string;
  data?: Record<string, unknown>;
}

export interface TransactionParams {
  type: 'swap' | 'transfer' | 'stake' | 'unstake';
  details: Record<string, unknown>;
}

export interface BuiltTransaction {
  serialized: string;
  estimatedFee: number;
  expiresAt: Date;
}
