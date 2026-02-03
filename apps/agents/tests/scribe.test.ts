import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Scribe } from '../src/agents/scribe';
import { TradeExplanation, PortfolioReport } from '@aegis/shared';

// Mock ChatAnthropic
const mockInvoke = vi.fn();
vi.mock('@langchain/anthropic', () => {
  return {
    ChatAnthropic: vi.fn().mockImplementation(() => ({
      invoke: mockInvoke
    }))
  };
});

describe('Scribe Agent', () => {
  let scribe: Scribe;

  beforeEach(() => {
    vi.clearAllMocks();
    scribe = new Scribe({ modelName: 'claude-mock' });
  });

  describe('explainTrade', () => {
    it('should return a string explanation', async () => {
      mockInvoke.mockResolvedValueOnce({ content: "This is a mocked explanation." });

      const trade: TradeExplanation = {
        action: 'buy',
        inputToken: 'USDC',
        outputToken: 'SOL',
        amount: 100,
        reason: 'Bullish signal',
        confidence: 0.8,
        agentVotes: []
      };

      const explanation = await scribe.explainTrade(trade);
      expect(explanation).toBe("This is a mocked explanation.");
      expect(mockInvoke).toHaveBeenCalled();
    });
  });

  describe('generateReport', () => {
    it('should parse JSON response from LLM', async () => {
      const mockReport = {
        title: "Test Report",
        summary: "A summary",
        sections: []
      };
      
      mockInvoke.mockResolvedValueOnce({ 
        content: JSON.stringify(mockReport) 
      });

      const portfolio: PortfolioReport = {
        period: 'daily',
        startValue: 1000,
        endValue: 1100,
        trades: [],
        topPerformers: [],
        bottomPerformers: [],
        insights: []
      };

      const report = await scribe.generateReport(portfolio);
      expect(report.title).toBe("Test Report");
      expect(report.summary).toBe("A summary");
    });

    it('should handle invalid JSON gracefully', async () => {
      mockInvoke.mockResolvedValueOnce({ 
        content: "Not JSON" 
      });

      const portfolio: PortfolioReport = {
        period: 'daily',
        startValue: 1000,
        endValue: 1100,
        trades: [],
        topPerformers: [],
        bottomPerformers: [],
        insights: []
      };

      const report = await scribe.generateReport(portfolio);
      expect(report.title).toContain("Error");
      expect(report.sections[0].heading).toBe("Raw Output");
    });
  });
});
