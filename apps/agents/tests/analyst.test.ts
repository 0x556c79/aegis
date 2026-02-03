import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Analyst } from '../src/agents/analyst';
import { HeliusTool } from '../src/tools/helius';

// Mock HeliusTool
vi.mock('../src/tools/helius', () => {
  return {
    HeliusTool: vi.fn().mockImplementation(() => ({
      getBalances: vi.fn().mockResolvedValue([
        {
          mint: 'So11111111111111111111111111111111111111112',
          amount: 1000000000,
          decimals: 9,
          uiAmount: 1,
          symbol: 'SOL',
          name: 'Solana',
          priceUsd: 150,
          valueUsd: 150
        },
        {
          mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
          amount: 1000000,
          decimals: 6,
          uiAmount: 1,
          symbol: 'JUP',
          name: 'Jupiter',
          priceUsd: 1.5,
          valueUsd: 1.5
        }
      ]),
      getTokenMetadata: vi.fn().mockResolvedValue([])
    }))
  };
});

// Mock fetch for DexScreener
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Analyst Agent', () => {
  let analyst: Analyst;

  beforeEach(() => {
    vi.clearAllMocks();
    analyst = new Analyst({ heliusApiKey: 'test-api-key' });
  });

  describe('analyzeToken', () => {
    it('should analyze a token correctly', async () => {
      const mockDexData = {
        pairs: [{
          chainId: 'solana',
          dexId: 'raydium',
          baseToken: { symbol: 'JUP', name: 'Jupiter' },
          priceUsd: '1.5',
          priceChange: { h24: 10 },
          volume: { h24: 500000 },
          marketCap: 1000000000,
          liquidity: { usd: 2000000 }
        }]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDexData
      });

      const analysis = await analyst.analyzeToken('JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN');

      expect(analysis.symbol).toBe('JUP');
      expect(analysis.price).toBe(1.5);
      expect(analysis.recommendation).toBe('buy'); // Price change > 5 and volume > 100k -> buy
      expect(analysis.confidence).toBe(0.7);
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found'
      });

      await expect(analyst.analyzeToken('invalid-mint'))
        .rejects.toThrow('No data found for token: invalid-mint');
    });
  });

  describe('scanOpportunities', () => {
    it('should return opportunities for bullish tokens', async () => {
      // Mock responses for the tokens in the scan list
      // Since scanOpportunities loops through predefined tokens, we need to mock fetch accordingly
      // Or just mock one successful call if we can control the order.
      // The implementation loops: SOL, JUP, BONK, WIF.
      
      // We'll just mock generic success for all calls
      const mockDexData = {
        pairs: [{
          chainId: 'solana',
          dexId: 'raydium',
          baseToken: { symbol: 'TEST', name: 'Test Token' },
          priceUsd: '1.0',
          priceChange: { h24: 10 }, // Bullish
          volume: { h24: 200000 },
          liquidity: { usd: 5000000 }
        }]
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockDexData
      });

      const opportunities = await analyst.scanOpportunities();
      expect(opportunities.length).toBeGreaterThan(0);
      expect(opportunities[0].type).toBe('trend');
    });
  });

  describe('analyzePortfolio', () => {
    it('should analyze portfolio correctly', async () => {
      // HeliusTool mock is already set up to return SOL and JUP balances
      
      const portfolio = await analyst.analyzePortfolio('wallet-address');

      expect(portfolio.totalValue).toBe(151.5); // 150 + 1.5
      expect(portfolio.holdings).toHaveLength(2);
      expect(portfolio.holdings[0].symbol).toBe('SOL');
    });
  });
});
