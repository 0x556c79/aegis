/**
 * Helius API Integration
 * 
 * Wrapper for Helius RPC, webhooks, and DAS API.
 */
import { z } from 'zod';

export interface HeliusConfig {
  apiKey: string;
  rpcEndpoint?: string;
  cluster?: 'mainnet-beta' | 'devnet';
}

// Zod schemas for RPC validation
const RpcResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  result: z.unknown(),
  id: z.string(),
  error: z.object({
    code: z.number(),
    message: z.string(),
  }).optional(),
});

const AssetSchema = z.object({
  id: z.string(),
  interface: z.string(),
  content: z.object({
    metadata: z.object({
      name: z.string().optional(),
      symbol: z.string().optional(),
      description: z.string().optional(),
    }).optional(),
    links: z.object({
      image: z.string().optional(),
    }).optional(),
    json_uri: z.string().optional(),
  }).optional(),
  token_info: z.object({
    balance: z.number().optional(),
    decimals: z.number().optional(),
    price_info: z.object({
      price_per_token: z.number().optional(),
      total_price: z.number().optional(),
    }).optional(),
  }).optional(),
}).passthrough();

const AssetsResponseSchema = z.object({
  items: z.array(AssetSchema),
});

const SolBalanceResponseSchema = z.object({
  value: z.number(),
});

const WebhookSchema = z.object({
  webhookID: z.string(),
  wallet: z.string(),
  webhookURL: z.string(),
  transactionTypes: z.array(z.string()),
  accountAddresses: z.array(z.string()),
  webhookType: z.string().optional(),
});

export class HeliusTool {
  private config: HeliusConfig;
  private baseUrl: string;

  constructor(config: HeliusConfig) {
    this.config = config;
    const cluster = this.config.cluster || 'devnet';
    
    // Set RPC Endpoint based on cluster if not provided
    if (!this.config.rpcEndpoint) {
      if (cluster === 'mainnet-beta') {
        this.config.rpcEndpoint = `https://mainnet.helius-rpc.com/?api-key=${config.apiKey}`;
      } else {
        this.config.rpcEndpoint = `https://api-devnet.helius-rpc.com/?api-key=${config.apiKey}`;
      }
    }

    this.baseUrl = cluster === 'mainnet-beta' 
      ? 'https://api.helius-rpc.com' 
      : 'https://api-devnet.helius-rpc.com';
  }

  private async rpcCall<T>(method: string, params: any[], schema: z.ZodType<T>): Promise<T> {
    const response = await fetch(this.config.rpcEndpoint!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'aegis-agent',
        method,
        params,
      }),
    });

    const rawData = await response.json();
    
    // Validate basic RPC structure
    const rpcResponse = RpcResponseSchema.parse(rawData);
    
    if (rpcResponse.error) {
      throw new Error(`Helius RPC Error: ${rpcResponse.error.message}`);
    }

    // Validate result against specific schema
    return schema.parse(rpcResponse.result);
  }

  /**
   * Get native SOL balance
   */
  async getSolBalance(walletAddress: string): Promise<number> {
    try {
      const result = await this.rpcCall('getBalance', [walletAddress], SolBalanceResponseSchema);
      return result.value; // Lambda (lamports)
    } catch (error) {
      console.error('Error fetching SOL balance:', error);
      return 0;
    }
  }

  /**
   * Get token balances for a wallet
   */
  async getBalances(walletAddress: string): Promise<TokenBalance[]> {
    try {
      const balances: TokenBalance[] = [];

      // 1. Get Native SOL Balance
      const lamports = await this.getSolBalance(walletAddress);
      if (lamports > 0) {
        balances.push({
          mint: 'So11111111111111111111111111111111111111112',
          amount: lamports,
          decimals: 9,
          uiAmount: lamports / 1e9,
          symbol: 'SOL',
          name: 'Solana',
          logoUri: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
          priceUsd: 0, // Would need a separate price fetch for SOL if not using DAS for it
          valueUsd: 0
        });
      }

      // 2. Get SPL Tokens via DAS API
      try {
        const result = await this.rpcCall('getAssetsByOwner', [
          {
            ownerAddress: walletAddress,
            page: 1,
            limit: 1000,
            displayOptions: {
              showFungible: true,
              showNativeBalance: false, // We handled SOL separately
            },
          },
        ], AssetsResponseSchema);

        const items = result.items || [];
        
        items.forEach((item) => {
          const tokenInfo = item.token_info || {};
          const content = item.content || {};
          const metadata = content.metadata || {};
          
          const decimals = tokenInfo.decimals || 0;
          const amount = tokenInfo.balance || 0;
          
          // Skip if no balance (unless we want to track 0 balances)
          if (amount <= 0) return;

          const uiAmount = amount / Math.pow(10, decimals);
          
          // Check if we already added SOL (if DAS returns it despite showNativeBalance: false or overlapping)
          if (item.id === '11111111111111111111111111111111') return;

          balances.push({
            mint: item.id,
            amount: amount,
            decimals: decimals,
            uiAmount: uiAmount,
            symbol: metadata.symbol || 'UNKNOWN',
            name: metadata.name || 'Unknown Token',
            logoUri: content.links?.image,
            priceUsd: tokenInfo.price_info?.price_per_token,
            valueUsd: tokenInfo.price_info?.total_price,
          });
        });

      } catch (dasError) {
        console.error('Error fetching DAS assets:', dasError);
        // Continue with just SOL if DAS fails
      }

      return balances;
    } catch (error) {
      console.error('Error in getBalances:', error);
      return [];
    }
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(walletAddress: string, limit = 100): Promise<Transaction[]> {
     // Not strictly needed for Analyst core task right now, skipping for MVP/Time
     // But implementing basic structure for future use
     return [];
  }

  /**
   * Subscribe to wallet changes via webhook
   */
  async createWebhook(params: WebhookParams): Promise<Webhook> {
     // Use the base URL derived from cluster
     const url = `${this.baseUrl}/v0/webhooks?api-key=${this.config.apiKey}`;
     
     const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            webhookURL: params.webhookUrl,
            transactionTypes: params.transactionTypes,
            accountAddresses: params.accountAddresses,
            webhookType: params.webhookType,
        }),
     });
     
     if (!response.ok) {
        throw new Error(`Failed to create webhook: ${response.statusText}`);
     }

     const rawData = await response.json();
     return WebhookSchema.parse(rawData) as Webhook;
  }

  /**
   * Get token metadata
   */
  async getTokenMetadata(mintAddresses: string[]): Promise<TokenMetadata[]> {
    try {
        // Using any for the response here for simplicity but wrapped in rpcCall would be better
        // However, rpcCall expects a specific schema. Let's make a generic one or loose one.
        const result = await this.rpcCall('getAssetBatch', [{
            ids: mintAddresses
        }], z.array(AssetSchema));

        return result.map((item) => ({
            mint: item.id,
            name: item.content?.metadata?.name || '',
            symbol: item.content?.metadata?.symbol || '',
            uri: item.content?.json_uri || '',
            decimals: item.token_info?.decimals || 0,
            image: item.content?.links?.image,
            description: item.content?.metadata?.description
        }));
    } catch (error) {
        console.error('Error fetching token metadata:', error);
        return [];
    }
  }
}

export interface TokenBalance {
  mint: string;
  amount: number;
  decimals: number;
  uiAmount: number;
  symbol?: string;
  name?: string;
  logoUri?: string;
  priceUsd?: number;
  valueUsd?: number;
}

export interface Transaction {
  signature: string;
  timestamp: number;
  type: string;
  description: string;
  fee: number;
  feePayer: string;
  tokenTransfers: TokenTransfer[];
}

export interface TokenTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  fromTokenAccount: string;
  toTokenAccount: string;
  tokenAmount: number;
  mint: string;
}

export interface WebhookParams {
  webhookUrl: string;
  transactionTypes: string[];
  accountAddresses: string[];
  webhookType: 'enhanced' | 'raw';
}

export interface Webhook {
  webhookID: string;
  wallet: string;
  webhookURL: string;
  transactionTypes: string[];
  accountAddresses: string[];
}

export interface TokenMetadata {
  mint: string;
  name: string;
  symbol: string;
  uri: string;
  decimals: number;
  image?: string;
  description?: string;
}
