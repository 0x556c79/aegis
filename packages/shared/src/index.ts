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

// Scribe Types
export interface TradeExplanation {
  action: 'buy' | 'sell' | 'swap';
  inputToken: string;
  outputToken: string;
  amount: number;
  reason: string;
  confidence: number;
  agentVotes: { agent: string; vote: boolean }[];
}

export interface TradeRecord {
  id: string;
  type: 'buy' | 'sell' | 'swap';
  inputToken: string;
  outputToken: string;
  inputAmount: number;
  outputAmount: number;
  pnl: number;
  timestamp: Date;
}

export interface PortfolioReport {
  period: 'daily' | 'weekly' | 'monthly';
  startValue: number;
  endValue: number;
  trades: TradeRecord[];
  topPerformers: { symbol: string; pnl: number }[];
  bottomPerformers: { symbol: string; pnl: number }[];
  insights: string[];
}

export interface ReportSection {
  heading: string;
  content: string;
  data?: Record<string, unknown>;
}

export interface Report {
  title: string;
  summary: string;
  sections: ReportSection[];
  generatedAt: Date;
}

export interface ConversationContext {
  userId: string;
  previousMessages: { role: 'user' | 'assistant'; content: string }[];
  portfolio?: { totalValue: number; holdings: { symbol: string; value: number }[] };
}

export interface QueryResponse {
  answer: string;
  suggestedActions?: string[];
  relatedData?: Record<string, unknown>;
}

export interface AgentActivity {
  agent: string;
  action: string;
  details: Record<string, unknown>;
  timestamp: Date;
  outcome?: string;
}

// Overseer Types
export interface AgentProposal {
  id: string;
  type: 'trade' | 'rebalance' | 'alert';
  proposedBy: string;
  details: Record<string, unknown>;
  timestamp: Date;
}

export interface ConsensusResult {
  approved: boolean;
  votes: { agent: string; vote: boolean; confidence: number }[];
  finalScore: number;
}

export interface PendingAction {
  id: string;
  type: string;
  estimatedValue: number;
  description: string;
  payload?: Record<string, unknown>;
}

export interface SwarmTask {
  id: string;
  type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  payload: Record<string, unknown>;
}

export interface TaskResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export const REDIS_CHANNELS = {
  HELIUS_WEBHOOK: 'helius-webhook-events',
  RISK_ALERTS: 'risk-alerts',
} as const;
