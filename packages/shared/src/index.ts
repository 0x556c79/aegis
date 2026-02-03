/**
 * Shared types/utilities across AEGIS packages.
 * Keep this package dependency-light.
 */

export type SwarmAgentName = 'overseer' | 'analyst' | 'trader' | 'sentinel' | 'scribe';

export interface SwarmEvent<T = unknown> {
  id: string;
  type: string;
  agent: SwarmAgentName;
  timestamp: number;
  payload: T;
}

// Analyst Types
export interface TokenAnalysis {
  mint: string;
  symbol: string;
  name: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  liquidity: number;
  holders: number;
  riskScore: number;
  signals: Signal[];
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  confidence: number;
}

export interface Signal {
  type: 'bullish' | 'bearish' | 'neutral';
  source: string;
  message: string;
  weight: number;
  timestamp: Date;
}

export interface Opportunity {
  id: string;
  type: 'token_discovery' | 'arbitrage' | 'trend' | 'whale_movement';
  asset: string;
  description: string;
  expectedReturn: number;
  riskLevel: 'low' | 'medium' | 'high';
  confidence: number;
  expiresAt?: Date;
}

export interface PortfolioAnalysis {
  totalValue: number;
  holdings: Holding[];
  diversificationScore: number;
  riskScore: number;
  suggestions: string[];
}

export interface Holding {
  mint: string;
  symbol: string;
  amount: number;
  value: number;
  percentage: number;
  pnl: number;
  pnlPercentage: number;
}
