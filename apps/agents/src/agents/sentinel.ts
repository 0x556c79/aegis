/**
 * SENTINEL Agent - Risk Management
 * 
 * Monitors positions, triggers stop-loss, and manages portfolio risk.
 * The guardian that protects user funds.
 */

import { z } from 'zod';
import { HeliusTool, type TokenBalance } from '../tools/helius';

export const SentinelConfigSchema = z.object({
  checkInterval: z.number().int().positive().default(30000), // ms (30s default)
  defaultStopLoss: z.number().min(0).max(100).default(10), // percentage
  defaultTakeProfit: z.number().min(0).max(1000).default(50), // percentage
  maxPositionSize: z.number().min(0).max(100).default(25), // percentage of portfolio
  heliusApiKey: z.string().optional(),
});

export type SentinelConfig = z.infer<typeof SentinelConfigSchema>;

export class Sentinel {
  private config: SentinelConfig;
  private isMonitoring: boolean = false;
  private helius: HeliusTool | null = null;
  private positions: Map<string, Position> = new Map(); // mint -> Position
  private monitoringTimer: NodeJS.Timeout | null = null;
  private walletAddress: string | null = null;

  constructor(config: Partial<SentinelConfig> = {}) {
    this.config = SentinelConfigSchema.parse(config);
    if (this.config.heliusApiKey) {
      this.helius = new HeliusTool({ apiKey: this.config.heliusApiKey });
    }
  }

  /**
   * Start monitoring positions
   */
  async startMonitoring(walletAddress: string): Promise<void> {
    if (this.isMonitoring) return;
    
    if (!this.helius) {
        throw new Error('Helius API key required to start monitoring');
    }

    this.walletAddress = walletAddress;
    this.isMonitoring = true;
    console.log(`Sentinel starting watch on ${walletAddress}`);

    // Initial fetch to populate positions
    await this.updatePortfolio(walletAddress);

    // Register Webhook (Fire and forget, assuming infrastructure handles the callback)
    try {
        await this.helius.createWebhook({
            webhookUrl: process.env.HELIUS_WEBHOOK_URL || 'https://api.aegis.bot/webhooks/helius',
            transactionTypes: ['SWAP', 'TRANSFER'],
            accountAddresses: [walletAddress],
            webhookType: 'enhanced',
        });
        console.log('Webhook registered for wallet monitoring');
    } catch (e) {
        console.warn('Failed to register webhook, falling back to polling only:', e);
    }

    // Start Polling Interval for Price Checks
    this.monitoringTimer = setInterval(async () => {
        try {
            await this.updatePortfolio(walletAddress);
            await this.runRiskChecks();
        } catch (e) {
            console.error('Error in monitoring loop:', e);
        }
    }, this.config.checkInterval);
  }

  /**
   * Stop monitoring
   */
  async stopMonitoring(): Promise<void> {
    this.isMonitoring = false;
    if (this.monitoringTimer) {
        clearInterval(this.monitoringTimer);
        this.monitoringTimer = null;
    }
  }

  /**
   * Update internal portfolio state
   */
  private async updatePortfolio(walletAddress: string): Promise<void> {
    if (!this.helius) return;

    const balances = await this.helius.getBalances(walletAddress);
    
    for (const balance of balances) {
        const existing = this.positions.get(balance.mint);
        
        // If we already track this, update current price/value
        // If it's new, initialize it (Entry price = current price as best effort)
        
        const currentPrice = balance.priceUsd || 0;
        const value = balance.valueUsd || (balance.uiAmount * currentPrice);

        if (existing) {
            existing.currentPrice = currentPrice;
            existing.value = value;
            existing.amount = balance.uiAmount;
            
            // Recalculate PnL
            if (existing.entryPrice > 0) {
                existing.pnl = (currentPrice - existing.entryPrice) * existing.amount;
                existing.pnlPercentage = ((currentPrice - existing.entryPrice) / existing.entryPrice) * 100;
            }
            
            this.positions.set(balance.mint, existing);
        } else {
            // New position found
            const newPos: Position = {
                id: `${walletAddress}-${balance.mint}`,
                mint: balance.mint,
                symbol: balance.symbol || 'UNK',
                amount: balance.uiAmount,
                entryPrice: currentPrice, // Assuming entry is now
                currentPrice: currentPrice,
                value: value,
                pnl: 0,
                pnlPercentage: 0,
                stopLoss: currentPrice * (1 - this.config.defaultStopLoss / 100),
                takeProfit: currentPrice * (1 + this.config.defaultTakeProfit / 100)
            };
            this.positions.set(balance.mint, newPos);
        }
    }
    
    // Remove positions that are no longer in balances (sold)
    const activeMints = new Set(balances.map(b => b.mint));
    for (const [mint] of this.positions) {
        if (!activeMints.has(mint)) {
            this.positions.delete(mint);
        }
    }
  }

  /**
   * Run risk checks on all positions
   */
  private async runRiskChecks(): Promise<void> {
     const portfolio = this.getPortfolio();
     if (!portfolio) return;

     const risks = await this.evaluateRisk(portfolio);
     const rebalanceActions = await this.suggestRebalance(portfolio);

     if (rebalanceActions.length > 0) {
         console.log('Rebalance Suggestions:', rebalanceActions);
         // In a real system, we would emit an event here:
         // eventBus.emit('risk_alert', { risks, actions: rebalanceActions });
     }

     for (const pos of portfolio.positions) {
         const stopLoss = await this.checkStopLoss(pos);
         if (stopLoss.shouldTrigger) {
             console.warn(`STOP LOSS TRIGGERED for ${pos.symbol}:`, stopLoss.reason);
             // eventBus.emit('stop_loss', { position: pos, details: stopLoss });
         }
     }
  }

  private getPortfolio(): Portfolio | null {
      if (!this.walletAddress) return null;
      
      const positions = Array.from(this.positions.values());
      const totalValue = positions.reduce((sum, p) => sum + p.value, 0);
      
      // Assume USDC/USDT is cash (simplified)
      const cashTokens = ['EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'];
      const cashBalance = positions
        .filter(p => cashTokens.includes(p.mint))
        .reduce((sum, p) => sum + p.value, 0);

      return {
          walletAddress: this.walletAddress,
          totalValue,
          positions,
          cashBalance
      };
  }

  /**
   * Check if stop-loss should trigger
   */
  async checkStopLoss(position: Position): Promise<StopLossCheck> {
    if (!position.stopLoss) {
        return { shouldTrigger: false, urgency: 'low' };
    }

    // Stop Loss Trigger
    if (position.currentPrice <= position.stopLoss) {
        const dropPct = Math.abs(position.pnlPercentage).toFixed(2);
        return {
            shouldTrigger: true,
            reason: `Price ${position.currentPrice} hit stop loss level ${position.stopLoss.toFixed(4)} (Drop: ${dropPct}%)`,
            suggestedAction: 'sell_all',
            urgency: 'critical'
        };
    }

    // Trailing Stop Loss Logic (Simple implementation: if profit > X, move SL up? Not implemented in basic version)
    // Take Profit Trigger
    if (position.takeProfit && position.currentPrice >= position.takeProfit) {
        return {
            shouldTrigger: true,
            reason: `Price ${position.currentPrice} hit take profit level ${position.takeProfit.toFixed(4)}`,
            suggestedAction: 'sell_partial',
            urgency: 'medium'
        };
    }

    return { shouldTrigger: false, urgency: 'low' };
  }

  /**
   * Evaluate portfolio risk
   */
  async evaluateRisk(portfolio: Portfolio): Promise<RiskAssessment> {
    const factors: RiskFactor[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];
    let overallScore = 100;

    // 1. Concentration Risk
    const maxPos = Math.max(...portfolio.positions.map(p => p.value));
    const maxPosPct = (maxPos / portfolio.totalValue) * 100;
    
    if (maxPosPct > this.config.maxPositionSize) {
        const scoreHit = (maxPosPct - this.config.maxPositionSize) * 2;
        overallScore -= scoreHit;
        factors.push({
            name: 'Concentration Risk',
            score: Math.max(0, 100 - scoreHit),
            weight: 0.4,
            description: `Largest position is ${maxPosPct.toFixed(1)}% of portfolio (Max: ${this.config.maxPositionSize}%)`
        });
        warnings.push('High portfolio concentration detected.');
        recommendations.push('Reduce size of largest holdings.');
    } else {
        factors.push({ name: 'Concentration Risk', score: 100, weight: 0.4, description: 'Portfolio is well diversified.' });
    }

    // 2. Cash Drag / Liquidity Risk
    const cashPct = (portfolio.cashBalance / portfolio.totalValue) * 100;
    if (cashPct < 5) {
        overallScore -= 10;
        factors.push({
            name: 'Liquidity Risk',
            score: 50,
            weight: 0.2,
            description: `Low cash reserves (${cashPct.toFixed(1)}%)`
        });
        warnings.push('Low cash balance available for buying opportunities or fees.');
    } else {
        factors.push({ name: 'Liquidity Risk', score: 100, weight: 0.2, description: 'Healthy cash reserves.' });
    }

    // 3. Volatility Exposure (Simplified: Non-Stablecoins are volatile)
    const stablecoins = ['EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'];
    const volatileValue = portfolio.positions
        .filter(p => !stablecoins.includes(p.mint))
        .reduce((sum, p) => sum + p.value, 0);
    const volatilePct = (volatileValue / portfolio.totalValue) * 100;

    if (volatilePct > 90) {
        overallScore -= 10;
        factors.push({
            name: 'Volatility Exposure',
            score: 80,
            weight: 0.3,
            description: `High exposure to volatile assets (${volatilePct.toFixed(1)}%)`
        });
    }

    return {
        overallScore: Math.max(0, Math.round(overallScore)),
        factors,
        warnings,
        recommendations
    };
  }

  /**
   * Suggest rebalancing actions
   */
  async suggestRebalance(portfolio: Portfolio): Promise<RebalanceAction[]> {
    const actions: RebalanceAction[] = [];

    // Check Concentration Limit
    for (const pos of portfolio.positions) {
        const pct = (pos.value / portfolio.totalValue) * 100;
        
        if (pct > this.config.maxPositionSize) {
            actions.push({
                type: 'decrease',
                mint: pos.mint,
                currentPercentage: pct,
                targetPercentage: this.config.maxPositionSize,
                reason: `Exceeds max position size of ${this.config.maxPositionSize}%`,
                priority: 10
            });
        }
    }

    // Check Cash Reserves (if too high, maybe suggest buy? Or leave that to Analyst/Trader. Sentinel focuses on SAFETY)
    // Sentinel mainly suggests reducing risk.

    return actions;
  }
}

// Type definitions
export interface Position {
  id: string;
  mint: string;
  symbol: string;
  entryPrice: number;
  currentPrice: number;
  amount: number;
  value: number;
  pnl: number;
  pnlPercentage: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface StopLossCheck {
  shouldTrigger: boolean;
  reason?: string;
  suggestedAction?: 'sell_all' | 'sell_partial' | 'hold';
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

export interface Portfolio {
  walletAddress: string;
  totalValue: number;
  positions: Position[];
  cashBalance: number;
}

export interface RiskAssessment {
  overallScore: number; // 0-100, lower is riskier
  factors: RiskFactor[];
  warnings: string[];
  recommendations: string[];
}

export interface RiskFactor {
  name: string;
  score: number;
  weight: number;
  description: string;
}

export interface RebalanceAction {
  type: 'increase' | 'decrease' | 'exit';
  mint: string;
  currentPercentage: number;
  targetPercentage: number;
  reason: string;
  priority: number;
}
