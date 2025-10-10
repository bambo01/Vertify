import { http, createConfig } from 'wagmi';
import { base, baseSepolia, mainnet } from 'wagmi/chains';
import { coinbaseWallet, injected, metaMask, walletConnect } from 'wagmi/connectors';

export const config = createConfig({
  chains: [base, baseSepolia, mainnet],
  connectors: [
    injected(),
    metaMask(),
    coinbaseWallet({
      appName: 'TruthChain',
      preference: 'smartWalletOnly',
    }),
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo',
    }),
  ],
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
    [mainnet.id]: http(),
  },
  ssr: true,
});
