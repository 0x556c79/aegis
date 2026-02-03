/**
 * Helius API Integration
 * 
 * Wrapper for Helius RPC, webhooks, and DAS API.
 */

export interface HeliusConfig {
  apiKey: string;
  rpcEndpoint?: string;
}

export class HeliusTool {
  private config: HeliusConfig;

  constructor(config: HeliusConfig) {
    this.config = config;
    this.config.rpcEndpoint = this.config.rpcEndpoint || 
      `https://mainnet.helius-rpc.com/?api-key=${config.apiKey}`;
  }

  private async rpcCall(method: string, params: any[]) {
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

    const data = await response.json();
    if (data.error) {
      throw new Error(`Helius RPC Error: ${data.error.message}`);
    }
    return data.result;
  }

  /**
   * Get token balances for a wallet
   */
  async getBalances(walletAddress: string): Promise<TokenBalance[]> {
    try {
      // Use DAS API getAssetsByOwner
      const result = await this.rpcCall('getAssetsByOwner', [
        {
          ownerAddress: walletAddress,
          page: 1,
          limit: 1000,
          displayOptions: {
            showFungible: true,
            showNativeBalance: true,
          },
        },
      ]);

      const items = result.items || [];
      const balances: TokenBalance[] = items.map((item: any) => {
        const tokenInfo = item.token_info || {};
        const content = item.content || {};
        const metadata = content.metadata || {};
        
        // Handle native SOL
        if (item.id === '11111111111111111111111111111111' || item.interface === 'FungibleAsset' || item.interface === 'FungibleToken') {
           // Basic mapping
        }

        const decimals = tokenInfo.decimals || 0;
        const amount = tokenInfo.balance || 0;
        const uiAmount = amount / Math.pow(10, decimals);
        
        return {
          mint: item.id,
          amount: amount,
          decimals: decimals,
          uiAmount: uiAmount,
          symbol: metadata.symbol || 'UNKNOWN',
          name: metadata.name || 'Unknown Token',
          logoUri: content.links?.image,
          priceUsd: tokenInfo.price_info?.price_per_token, // If available
          valueUsd: tokenInfo.price_info?.total_price, // If available
        };
      });

      return balances.filter((b: TokenBalance) => b.uiAmount > 0);
    } catch (error) {
      console.error('Error fetching balances:', error);
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
     const response = await fetch(`https://api.helius.xyz/v0/webhooks?api-key=${this.config.apiKey}`, {
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
     
     const data = await response.json();
     return data as Webhook;
  }

  /**
   * Get token metadata
   */
  async getTokenMetadata(mintAddresses: string[]): Promise<TokenMetadata[]> {
    try {
        const result = await this.rpcCall('getAssetBatch', [{
            ids: mintAddresses
        }]);

        return result.map((item: any) => ({
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
  webhookId: string;
  wallet: string;
  webhookUrl: string;
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
