import { PrivyClientConfig } from '@privy-io/react-auth';

export const privyConfig: PrivyClientConfig = {
  // Customize Privy's appearance
  appearance: {
    theme: 'dark',
    accentColor: '#3b82f6', // blue-500
    logo: 'https://aegis.bot/logo.png', // Placeholder
    walletList: ['phantom', 'backpack', 'solflare'],
  },
  // Configure embedded wallets
  embeddedWallets: {
    createOnLogin: 'users-without-wallets',
    requireUserPasswordOnCreate: true,
  },
  // Supported chains
  supportedChains: [{
    id: 101, // Solana Mainnet (Use 103 for Devnet usually, but Privy might use string 'solana-devnet')
    name: 'Solana Devnet',
    network: 'solana-devnet',
    rpcUrls: {
        default: {
            http: ['https://api.devnet.solana.com'],
        },
    },
    nativeCurrency: {
        name: 'Solana',
        symbol: 'SOL',
        decimals: 9,
    },
    // @ts-ignore - Privy types might differ slightly per version
    blockExplorers: {
        default: {
            name: 'Solscan',
            url: 'https://solscan.io/?cluster=devnet',
        }
    }
  }],
  // Login methods
  loginMethods: ['email', 'wallet', 'google', 'twitter'],
};
