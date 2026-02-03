import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SwarmState } from '../src/workflows/swarm';

// Define hoisted mocks
const { mockAssessWallet, mockAnalyzeToken } = vi.hoisted(() => {
  return {
    mockAssessWallet: vi.fn(),
    mockAnalyzeToken: vi.fn(),
  };
});

// Mock dependencies
vi.mock('../src/agents/analyst', () => {
  return {
    Analyst: vi.fn().mockImplementation(() => ({
      analyzeToken: mockAnalyzeToken,
      analyzePortfolio: vi.fn().mockResolvedValue({
        totalValue: 1000,
        suggestions: ['Buy more MOCK']
      }),
      scanOpportunities: vi.fn().mockResolvedValue([])
    }))
  };
});

vi.mock('../src/agents/sentinel', () => {
  return {
    Sentinel: vi.fn().mockImplementation(() => ({
      assessWallet: mockAssessWallet
    }))
  };
});

vi.mock('../src/agents/trader', () => {
  return {
    Trader: vi.fn().mockImplementation(() => ({
      getQuote: vi.fn().mockResolvedValue({
        inputMint: 'SOL',
        outputMint: 'MOCK',
        inputAmount: 1000000n,
        outputAmount: 1230000n
      }),
      buildTransaction: vi.fn().mockResolvedValue({
        serialized: 'mock-tx-base64'
      })
    }))
  };
});

vi.mock('../src/agents/scribe', () => {
  return {
    Scribe: vi.fn().mockImplementation(() => ({
      explainTrade: vi.fn().mockResolvedValue('Trade explanation mock'),
      generateReport: vi.fn().mockResolvedValue({
        title: 'Mock Report',
        summary: 'Mock summary'
      })
    }))
  };
});

// Import Swarm AFTER mocks are set up
import { Swarm } from '../src/workflows/swarm';

describe('Swarm Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default happy path
    mockAnalyzeToken.mockResolvedValue({
        symbol: 'MOCK',
        price: 1.23,
        recommendation: 'buy',
        riskScore: 2,
        signals: [{ message: 'Mock signal' }]
    });
    
    mockAssessWallet.mockResolvedValue({
        overallScore: 85,
        recommendations: []
    });
  });

  it('should run a complete analysis flow', async () => {
    const request = {
      type: 'analyze_token',
      payload: { mint: 'MockMintAddress' }
    };
    
    const result = await Swarm.run(request, 'user1', 'wallet1');
    
    expect(result.intel.tokenAnalysis).toBeDefined();
    expect(result.intel.tokenAnalysis.symbol).toBe('MOCK');
    expect(result.isSafe).toBe(true);
    expect(result.finalResponse).toContain('Analysis: MOCK');
  });

  it('should run a trade flow successfully', async () => {
    const request = {
      type: 'trade',
      payload: { 
        inputMint: 'SOL', 
        outputMint: 'MOCK', 
        amount: 1000000, 
        mode: 'exactIn' 
      }
    };
    
    const result = await Swarm.run(request, 'user1', 'wallet1');
    
    expect(result.executionPlan).toBeDefined();
    expect(result.executionPlan.transaction).toBe('mock-tx-base64');
    expect(result.finalResponse).toContain('Transaction Prepared');
  });

  it('should halt on high risk', async () => {
    // Override Sentinel mock to return low score
    mockAssessWallet.mockResolvedValue({
        overallScore: 20, // Low score < 50
        recommendations: ['Sell everything']
    });

    const request = {
      type: 'trade',
      payload: { 
        inputMint: 'SOL', 
        outputMint: 'MOCK', 
        amount: 1000000 
      }
    };
    
    const result = await Swarm.run(request, 'user1', 'wallet1');
    
    expect(result.isSafe).toBe(false);
    expect(result.riskAssessment.overallScore).toBe(20);
    // Should NOT have execution plan
    expect(result.executionPlan).toBeNull(); // Default is null or undefined
    expect(result.finalResponse).toContain('Risk Alert');
  });
});
