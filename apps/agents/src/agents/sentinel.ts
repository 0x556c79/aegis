/**
 * SENTINEL Agent - Risk Management
 * 
 * Monitors positions, triggers stop-loss, and manages portfolio risk.
 * The guardian that protects user funds.
 */

import { z } from 'zod';

export const SentinelConfigSchema = z.object({
  checkInterval: z.number().int().positive().default(5000), // ms
  defaultStopLoss: z.number().min(0).max(100).default(10), // percentage
  defaultTakeProfit: z.number().min(0).max(1000).default(50), // percentage
  maxPositionSize: z.number().min(0).max(100).default(25), // percentage of portfolio
});

export type SentinelConfig = z.infer<typeof SentinelConfigSchema>;

export class Sentinel {
  private config: SentinelConfig;
  private isMonitoring: boolean = false;

  constructor(config: Partial<SentinelConfig> = {}) {
    this.config = SentinelConfigSchema.parse(config);
  }

  /**
   * Start monitoring positions
   */
  async startMonitoring(walletAddress: string): Promise<void> {
    // TODO: Start real-time position monitoring via Helius webhooks
    this.isMonitoring = true;
    throw new Error('Not implemented');
  }

  /**
   * Stop monitoring
   */
  async stopMonitoring(): Promise<void> {
    this.isMonitoring = false;
  }

  /**
   * Check if stop-loss should trigger
   */
  async checkStopLoss(position: Position): Promise<StopLossCheck> {
    // TODO: Implement stop-loss logic
    throw new Error('Not implemented');
  }

  /**
   * Evaluate portfolio risk
   */
  async evaluateRisk(portfolio: Portfolio): Promise<RiskAssessment> {
    // TODO: Calculate risk metrics
    throw new Error('Not implemented');
  }

  /**
   * Suggest rebalancing actions
   */
  async suggestRebalance(portfolio: Portfolio): Promise<RebalanceAction[]> {
    // TODO: Generate rebalancing suggestions
    throw new Error('Not implemented');
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
