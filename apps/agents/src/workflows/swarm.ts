/**
 * AEGIS Swarm Workflow
 * 
 * LangGraph-based multi-agent coordination workflow.
 * Orchestrates the 5 agents (Overseer, Analyst, Trader, Sentinel, Scribe).
 */

import { StateGraph, END } from '@langchain/langgraph';
import { z } from 'zod';
import { Analyst } from '../agents/analyst';
import { Sentinel } from '../agents/sentinel';
import { Trader } from '../agents/trader';
import { Scribe } from '../agents/scribe';
import { Overseer } from '../agents/overseer';
import type { SwarmRequest, SwarmResponse } from './swarm'; // Self-reference for types if needed, but defining them here is cleaner

// Define State Schema
export const SwarmStateSchema = z.object({
  // Input
  request: z.any(), // SwarmRequest
  userId: z.string(),
  walletAddress: z.string(),
  
  // Agent States
  intel: z.object({
    tokenAnalysis: z.any().optional(),
    portfolioAnalysis: z.any().optional(),
    opportunities: z.any().optional(),
  }).optional(),

  riskAssessment: z.any().optional(), // Sentinel RiskAssessment
  isSafe: z.boolean().default(true),
  
  executionPlan: z.object({
    quote: z.any().optional(),
    transaction: z.string().optional(),
  }).optional(),
  
  executionResult: z.any().optional(),
  
  finalResponse: z.string().optional(),
});

export type SwarmState = z.infer<typeof SwarmStateSchema>;

// Initialize Agents (Singleton-ish for the workflow)
// In a real app, these might be passed in or resolved from DI
const analyst = new Analyst();
const sentinel = new Sentinel();
const trader = new Trader();
const scribe = new Scribe();
const overseer = new Overseer();

// --- Nodes ---

async function analystNode(state: SwarmState): Promise<Partial<SwarmState>> {
  console.log('--- Phase 1: Analyst ---');
  const { request, walletAddress } = state;
  const intel: SwarmState['intel'] = {};

  try {
    if (request.type === 'analyze_token' && request.payload?.mint) {
      intel.tokenAnalysis = await analyst.analyzeToken(request.payload.mint);
    } else if (request.type === 'rebalance' || request.type === 'report') {
      intel.portfolioAnalysis = await analyst.analyzePortfolio(walletAddress);
    } else if (request.type === 'scan') {
      intel.opportunities = await analyst.scanOpportunities();
    } else if (request.type === 'trade' && request.payload?.mint) {
        // For trade, we analyze the token first
        intel.tokenAnalysis = await analyst.analyzeToken(request.payload.mint);
    }
  } catch (error) {
    console.error('Analyst Error:', error);
  }

  return { intel };
}

async function sentinelNode(state: SwarmState): Promise<Partial<SwarmState>> {
  console.log('--- Phase 2: Sentinel ---');
  const { walletAddress, intel } = state;
  
  // Always check wallet risk before proceeding
  const risk = await sentinel.assessWallet(walletAddress);
  
  let isSafe = true;
  if (risk && risk.overallScore < 50) {
      isSafe = false;
  }

  // If specific token analysis exists, check its risk score
  if (intel?.tokenAnalysis) {
      if (intel.tokenAnalysis.riskScore >= 8) { // High risk
          isSafe = false; // Or require higher approval
      }
  }

  return { 
    riskAssessment: risk, 
    isSafe 
  };
}

async function traderNode(state: SwarmState): Promise<Partial<SwarmState>> {
  console.log('--- Phase 4: Trader ---');
  const { request, isSafe, intel } = state;

  if (!isSafe) {
      return { executionResult: { success: false, error: 'Risk check failed' } };
  }

  // Handle Trade Request
  if (request.type === 'trade') {
      const { inputMint, outputMint, amount, mode } = request.payload;
      try {
        const quote = await trader.getQuote({
            inputMint,
            outputMint,
            amount: BigInt(amount),
            type: mode || 'exactIn'
        });

        // In this workflow, we prepare the transaction. Signing happens client-side usually.
        // We'll return the quote and a prepared transaction.
        // Note: We don't have the user's publicKey signer here, so we might just return the quote + unsigned tx.
        
        // For simulation, let's assume we build the unsigned tx
        const tx = await trader.buildTransaction({
            type: 'swap',
            details: { quote, userPublicKey: state.walletAddress }
        });

        return { 
            executionPlan: { quote, transaction: tx.serialized } 
        };

      } catch (e: any) {
          return { executionResult: { success: false, error: e.message } };
      }
  }

  return {};
}

async function scribeNode(state: SwarmState): Promise<Partial<SwarmState>> {
  console.log('--- Phase 5: Scribe ---');
  const { request, intel, riskAssessment, executionPlan, executionResult, isSafe } = state;
  
  let output = '';

  if (!isSafe) {
      output = `⚠️ **Risk Alert**\nSentinel halted the operation. Your portfolio risk score is ${riskAssessment?.overallScore}/100.\n`;
      if (riskAssessment?.recommendations.length) {
          output += `Recommendations: ${riskAssessment.recommendations.join(', ')}`;
      }
      return { finalResponse: output };
  }

  if (request.type === 'analyze_token' && intel?.tokenAnalysis) {
      const a = intel.tokenAnalysis;
      output = `📊 **Analysis: ${a.symbol}**\nPrice: $${a.price}\nRecommendation: ${a.recommendation.toUpperCase()}\nRisk Score: ${a.riskScore}/10\n\nSignals:\n${a.signals.map((s: any) => `- ${s.message}`).join('\n')}`;
  } else if (request.type === 'trade' && executionPlan?.quote) {
      const q = executionPlan.quote;
      // Use Scribe agent to explain
      output = await scribe.explainTrade({
          action: 'SWAP',
          inputToken: q.inputMint,
          outputToken: q.outputMint,
          amount: q.inputAmount.toString(),
          reason: 'User request',
          confidence: 1
      });
      output += `\n\n📝 **Transaction Prepared**\nSign to execute.`;
  } else if (request.type === 'report' && intel?.portfolioAnalysis) {
      const report = await scribe.generateReport({
          period: 'Current',
          startValue: intel.portfolioAnalysis.totalValue, // Mock
          endValue: intel.portfolioAnalysis.totalValue,
          topPerformers: [],
          bottomPerformers: [],
          insights: intel.portfolioAnalysis.suggestions
      });
      output = `## ${report.title}\n${report.summary}`;
  } else {
      output = "Task completed.";
  }

  return { finalResponse: output };
}

// --- Edges ---

function overseerRouting(state: SwarmState) {
  console.log('--- Phase 3: Overseer ---');
  const { isSafe, request } = state;
  
  if (!isSafe) {
      return 'scribe'; // Report risk failure
  }

  if (request.type === 'trade') {
      return 'trader';
  }

  return 'scribe'; // Default to reporting findings
}

// --- Graph Construction ---

const workflow = new StateGraph({
    channels: {
        request: { value: (a, b) => b ?? a, default: () => null },
        userId: { value: (a, b) => b ?? a, default: () => '' },
        walletAddress: { value: (a, b) => b ?? a, default: () => '' },
        intel: { value: (a, b) => ({ ...a, ...b }), default: () => ({}) },
        riskAssessment: { value: (a, b) => b ?? a, default: () => null },
        isSafe: { value: (a, b) => b ?? a, default: () => true },
        executionPlan: { value: (a, b) => b ?? a, default: () => null },
        executionResult: { value: (a, b) => b ?? a, default: () => null },
        finalResponse: { value: (a, b) => b ?? a, default: () => '' },
    }
});

workflow.addNode('analyst', analystNode);
workflow.addNode('sentinel', sentinelNode);
workflow.addNode('trader', traderNode);
workflow.addNode('scribe', scribeNode);

workflow.setEntryPoint('analyst');
workflow.addEdge('analyst', 'sentinel');
workflow.addConditionalEdges('sentinel', overseerRouting, {
    trader: 'trader',
    scribe: 'scribe'
});
workflow.addEdge('trader', 'scribe');
workflow.addEdge('scribe', END);

export const swarmGraph = workflow.compile();

export class Swarm {
    static async run(request: any, userId: string, walletAddress: string) {
        const result = await swarmGraph.invoke({
            request,
            userId,
            walletAddress,
            isSafe: true // default
        });
        return result;
    }
}
