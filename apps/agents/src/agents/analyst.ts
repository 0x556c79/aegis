/**
 * ANALYST Agent - Research & Signals
 * 
 * Analyzes tokens, social signals, and on-chain metrics.
 * Detects opportunities and provides research to the swarm.
 */

import { z } from 'zod';
import { HeliusTool, TokenBalance } from '../tools/helius';
import type { 
  TokenAnalysis, 
  Signal, 
  Opportunity, 
  PortfolioAnalysis, 
  Holding 
} from '@aegis/shared';

// DexScreener Validation Schema
const DexScreenerPairSchema = z.object({
  baseToken: z.object({
    name: z.string(),
    symbol: z.string(),
    address: z.string(),
  }),
  priceUsd: z.string(),
  priceChange: z.object({
    h24: z.number().optional(),
  }).optional(),
  volume: z.object({
    h24: z.number().optional(),
  }).optional(),
  marketCap: z.number().optional(),
  fdv: z.number().optional(),
  liquidity: z.object({
    usd: z.number().optional(),
  }).optional(),
}).passthrough();

const DexScreenerResponseSchema = z.object({
  pairs: z.array(DexScreenerPairSchema).nullable().optional(),
});

type DexScreenerPair = z.infer<typeof DexScreenerPairSchema>;

export const AnalystConfigSchema = z.object({
  dataRefreshInterval: z.number().int().positive().default(60000), // ms
  minConfidenceThreshold: z.number().min(0).max(1).default(0.7),
  maxTokensToTrack: z.number().int().positive().default(50),
  heliusApiKey: z.string().optional(),
});

export type AnalystConfig = z.infer<typeof AnalystConfigSchema>;

export class Analyst {
  private config: AnalystConfig;
  private helius: HeliusTool | null = null;

  constructor(config: Partial<AnalystConfig> = {}) {
    this.config = AnalystConfigSchema.parse(config);
    if (this.config.heliusApiKey) {
      this.helius = new HeliusTool({ apiKey: this.config.heliusApiKey });
    }
  }

  private async fetchDexScreenerData(mint: string): Promise<DexScreenerPair | null> {
    try {
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
      if (!response.ok) {
        throw new Error(`DexScreener API error: ${response.statusText}`);
      }
      
      const rawData = await response.json();
      const data = DexScreenerResponseSchema.parse(rawData);
      
      return data.pairs && data.pairs.length > 0 ? data.pairs[0] : null;
    } catch (error) {
      console.error(`Error fetching DexScreener data for ${mint}:`, error);
      return null;
    }
  }

  /**
   * Analyze a specific token
   */
  async analyzeToken(mint: string): Promise<TokenAnalysis> {
    const pair = await this.fetchDexScreenerData(mint);

    if (!pair) {
      throw new Error(`No data found for token: ${mint}`);
    }

    const price = parseFloat(pair.priceUsd);
    const priceChange24h = pair.priceChange?.h24 || 0;
    const volume24h = pair.volume?.h24 || 0;
    const marketCap = pair.marketCap || pair.fdv || 0;
    const liquidity = pair.liquidity?.usd || 0;
    
    // Simple heuristic for risk and recommendation
    let riskScore = 5; // 1-10 (10 is high risk)
    if (liquidity > 1_000_000) riskScore -= 2;
    if (marketCap > 10_000_000) riskScore -= 1;
    if (Math.abs(priceChange24h) > 20) riskScore += 2;

    const signals: Signal[] = [];
    let recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell' = 'hold';
    let confidence = 0.5;

    // Basic technical signal
    if (priceChange24h > 5 && volume24h > 100_000) {
        signals.push({
            type: 'bullish',
            source: 'price_action',
            message: 'Strong 24h momentum with volume',
            weight: 0.8,
            timestamp: new Date()
        });
        recommendation = 'buy';
        confidence = 0.7;
    } else if (priceChange24h < -10) {
        signals.push({
            type: 'bearish',
            source: 'price_action',
            message: 'Significant price drop',
            weight: 0.8,
            timestamp: new Date()
        });
        recommendation = 'sell';
        confidence = 0.6;
    }

    return {
      mint,
      symbol: pair.baseToken.symbol,
      name: pair.baseToken.name,
      price,
      priceChange24h,
      volume24h,
      marketCap,
      liquidity,
      holders: 0, // Not available in basic DexScreener pair data
      riskScore,
      signals,
      recommendation,
      confidence
    };
  }

  /**
   * Scan for new opportunities
   * Scans a predefined list of top tokens for now.
   */
  async scanOpportunities(): Promise<Opportunity[]> {
    // List of tokens to scan (Example: SOL, JUP, BONK, WIF)
    const tokensToScan = [
        'So11111111111111111111111111111111111111112', // SOL
        'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', // JUP
        'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
        'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm'  // WIF
    ];

    const opportunities: Opportunity[] = [];

    for (const mint of tokensToScan) {
        try {
            const analysis = await this.analyzeToken(mint);
            if (analysis.recommendation === 'buy' || analysis.recommendation === 'strong_buy') {
                opportunities.push({
                    id: `opp_${mint}_${Date.now()}`,
                    type: 'trend',
                    asset: analysis.symbol,
                    description: `Bullish signal on ${analysis.symbol}: ${analysis.signals[0]?.message}`,
                    expectedReturn: 0.1, // Mock
                    riskLevel: analysis.riskScore > 7 ? 'high' : analysis.riskScore > 4 ? 'medium' : 'low',
                    confidence: analysis.confidence
                });
            }
        } catch (e) {
            // Ignore errors for individual tokens during scan
        }
    }

    return opportunities;
  }

  /**
   * Get portfolio health metrics
   */
  async analyzePortfolio(walletAddress: string): Promise<PortfolioAnalysis> {
    if (!this.helius) {
        throw new Error('Helius API key required for portfolio analysis');
    }

    const balances = await this.helius.getBalances(walletAddress);
    
    let totalValue = 0;
    const holdings: Holding[] = [];

    for (const balance of balances) {
        // Try to get real-time price from DexScreener if Helius price is missing or we want fresh data
        let price = balance.priceUsd || 0;
        
        // Fetch from DexScreener if price is 0 (skipping for SOL to save calls if Helius has it)
        if (price === 0 && balance.mint !== 'So11111111111111111111111111111111111111112') {
             const pair = await this.fetchDexScreenerData(balance.mint);
             if (pair) {
                 price = parseFloat(pair.priceUsd);
             }
        }

        const value = balance.uiAmount * price;
        totalValue += value;

        holdings.push({
            mint: balance.mint,
            symbol: balance.symbol || 'UNK',
            amount: balance.uiAmount,
            value,
            percentage: 0, // Calc later
            pnl: 0, // Requires history
            pnlPercentage: 0
        });
    }

    // Calculate percentages
    if (totalValue > 0) {
        holdings.forEach(h => {
            h.percentage = (h.value / totalValue) * 100;
        });
    }

    // Sort by value
    holdings.sort((a, b) => b.value - a.value);

    // Simple analysis
    const suggestions: string[] = [];
    if (holdings.length < 3 && totalValue > 100) {
        suggestions.push('Portfolio is concentrated. Consider diversifying.');
    }
    if (holdings.some(h => h.symbol === 'SOL' && h.percentage > 80)) {
        suggestions.push('High exposure to SOL. Consider stablecoins or ecosystem tokens.');
    }

    return {
        totalValue,
        holdings,
        diversificationScore: holdings.length * 10, // Mock
        riskScore: 5, // Mock
        suggestions
    };
  }
}
