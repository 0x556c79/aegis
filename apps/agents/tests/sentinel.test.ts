import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Sentinel } from '../src/agents/sentinel';
import { HeliusTool } from '../src/tools/helius';

// Mock HeliusTool
const createWebhookMock = vi.fn().mockResolvedValue({ webhookID: 'test-webhook-id' });
const getBalancesMock = vi.fn();

vi.mock('../src/tools/helius', () => {
  return {
    HeliusTool: vi.fn().mockImplementation(() => ({
      getBalances: getBalancesMock,
      createWebhook: createWebhookMock
    }))
  };
});

describe('Sentinel Agent', () => {
  let sentinel: Sentinel;
  const mockWallet = 'test-wallet-address';

  beforeEach(() => {
    vi.clearAllMocks();
    sentinel = new Sentinel({ 
        heliusApiKey: 'test-api-key',
        checkInterval: 100 // Short interval for testing
    });
  });

  afterEach(async () => {
      await sentinel.stopMonitoring();
  });

  describe('Configuration', () => {
      it('should load default config', () => {
          const s = new Sentinel({ heliusApiKey: 'key' });
          expect(s).toBeDefined();
      });
  });

  describe('startMonitoring', () => {
      it('should register webhook and fetch initial balances', async () => {
          getBalancesMock.mockResolvedValue([]);
          
          await sentinel.startMonitoring(mockWallet);
          
          expect(createWebhookMock).toHaveBeenCalled();
          expect(getBalancesMock).toHaveBeenCalledWith(mockWallet);
      });
  });

  describe('Risk Management', () => {
      it('should detect stop loss trigger', async () => {
          // Setup: Price drops significantly
          const entryPrice = 100;
          const currentPrice = 80; // 20% drop, default SL is 10%
          
          const position = {
              id: 'pos-1',
              mint: 'token-mint',
              symbol: 'TKN',
              amount: 10,
              entryPrice: entryPrice,
              currentPrice: currentPrice,
              value: currentPrice * 10,
              pnl: (currentPrice - entryPrice) * 10,
              pnlPercentage: -20,
              stopLoss: 90 // Set explicit stop loss at 90
          };

          const check = await sentinel.checkStopLoss(position);
          
          expect(check.shouldTrigger).toBe(true);
          expect(check.urgency).toBe('critical');
          expect(check.suggestedAction).toBe('sell_all');
      });

      it('should detect concentration risk', async () => {
          // Mock portfolio with high concentration
          const portfolio = {
              walletAddress: mockWallet,
              totalValue: 1000,
              cashBalance: 0,
              positions: [
                  {
                      id: '1',
                      mint: 'token-1',
                      symbol: 'TKN1',
                      entryPrice: 1,
                      currentPrice: 1,
                      amount: 900,
                      value: 900, // 90% of portfolio
                      pnl: 0,
                      pnlPercentage: 0
                  },
                  {
                      id: '2',
                      mint: 'token-2',
                      symbol: 'TKN2',
                      entryPrice: 1,
                      currentPrice: 1,
                      amount: 100,
                      value: 100, // 10%
                      pnl: 0,
                      pnlPercentage: 0
                  }
              ]
          };

          const risk = await sentinel.evaluateRisk(portfolio);
          
          expect(risk.overallScore).toBeLessThan(100);
          expect(risk.warnings).toContain('High portfolio concentration detected.');
          expect(risk.factors.find(f => f.name === 'Concentration Risk')?.score).toBeLessThan(100);
      });
  });

  describe('Rebalancing', () => {
      it('should suggest decreasing oversized positions', async () => {
           const portfolio = {
              walletAddress: mockWallet,
              totalValue: 1000,
              cashBalance: 0,
              positions: [
                  {
                      id: '1',
                      mint: 'token-1',
                      symbol: 'TKN1',
                      entryPrice: 1,
                      currentPrice: 1,
                      amount: 500,
                      value: 500, // 50% of portfolio
                      pnl: 0,
                      pnlPercentage: 0
                  }
              ]
          };
          // Config default maxPositionSize is 25%

          const actions = await sentinel.suggestRebalance(portfolio);
          
          expect(actions).toHaveLength(1);
          expect(actions[0].type).toBe('decrease');
          expect(actions[0].mint).toBe('token-1');
      });
  });
});
