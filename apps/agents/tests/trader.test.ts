import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Trader } from '../src/agents/trader';
import { JupiterTool } from '../src/tools/jupiter';

// Mock JupiterTool
vi.mock('../src/tools/jupiter', () => {
  return {
    JupiterTool: vi.fn().mockImplementation(() => ({
      getQuote: vi.fn().mockResolvedValue({
        inputMint: 'So11111111111111111111111111111111111111112',
        inAmount: '1000000000',
        outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        outAmount: '150000000',
        otherAmountThreshold: '149000000',
        swapMode: 'ExactIn',
        slippageBps: 50,
        priceImpactPct: '0.001',
        routePlan: [
          {
            swapInfo: {
              ammKey: 'amm-key',
              label: 'Raydium',
              inputMint: 'SOL',
              outputMint: 'USDC',
              inAmount: '1000000000',
              outAmount: '150000000',
              feeAmount: '1000',
              feeMint: 'SOL'
            },
            percent: 100
          }
        ]
      }),
      executeSwap: vi.fn().mockResolvedValue({
        swapTransaction: 'base64-transaction-string',
        lastValidBlockHeight: 12345678,
        prioritizationFeeLamports: 5000
      })
    }))
  };
});

describe('Trader Agent', () => {
  let trader: Trader;

  beforeEach(() => {
    vi.clearAllMocks();
    trader = new Trader({ jupiterApiKey: 'test-api-key' });
  });

  describe('getQuote', () => {
    it('should get a quote and map it correctly', async () => {
      const request = {
        inputMint: 'So11111111111111111111111111111111111111112', // SOL
        outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        amount: BigInt(1000000000), // 1 SOL
        type: 'exactIn' as const
      };

      const quote = await trader.getQuote(request);

      expect(quote.inputMint).toBe(request.inputMint);
      expect(quote.outputMint).toBe(request.outputMint);
      expect(quote.inputAmount).toBe(request.amount);
      expect(quote.outputAmount).toBe(BigInt(150000000));
      expect(quote.priceImpact).toBe(0.1); // 0.001 * 100
      expect(quote.route[0].protocol).toBe('Raydium');
      expect(quote.providerQuote).toBeDefined();
    });
  });

  describe('executeSwap', () => {
    const mockQuote = {
      id: 'test-id',
      inputMint: 'SOL',
      outputMint: 'USDC',
      inputAmount: BigInt(1000000000),
      outputAmount: BigInt(150000000),
      priceImpact: 0.1,
      route: [],
      fee: 0,
      expiresAt: new Date(),
      providerQuote: {} // mocked inside JupiterTool but needs to be present
    };

    it('should fail if providerQuote is missing', async () => {
      const badQuote = { ...mockQuote, providerQuote: undefined };
      await expect(trader.executeSwap(badQuote, 'user-pubkey')).rejects.toThrow('Invalid quote: missing provider data');
    });

    it('should return built transaction if no signer provided', async () => {
      const result = await trader.executeSwap(mockQuote, 'user-pubkey');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No signer provided');
      expect(result.data?.transaction).toBe('base64-transaction-string');
    });

    it('should sign and return success if signer provided', async () => {
      const mockSigner = vi.fn().mockResolvedValue('tx-signature');
      
      const result = await trader.executeSwap(mockQuote, 'user-pubkey', mockSigner);

      expect(result.success).toBe(true);
      expect(result.signature).toBe('tx-signature');
      expect(mockSigner).toHaveBeenCalledWith('base64-transaction-string');
    });
  });

  describe('buildTransaction', () => {
    it('should build a swap transaction', async () => {
      const mockQuote = {
        id: 'test-id',
        inputMint: 'SOL',
        outputMint: 'USDC',
        inputAmount: BigInt(1000000000),
        outputAmount: BigInt(150000000),
        priceImpact: 0.1,
        route: [],
        fee: 0,
        expiresAt: new Date(),
        providerQuote: {}
      };

      const params = {
        type: 'swap' as const,
        details: {
          quote: mockQuote,
          userPublicKey: 'user-pubkey'
        }
      };

      const result = await trader.buildTransaction(params);

      expect(result.serialized).toBe('base64-transaction-string');
      expect(result.estimatedFee).toBe(5000);
    });

    it('should throw for unsupported transaction types', async () => {
      const params = {
        type: 'stake' as const,
        details: {}
      };

      await expect(trader.buildTransaction(params)).rejects.toThrow('Transaction type stake not supported');
    });
  });
});
