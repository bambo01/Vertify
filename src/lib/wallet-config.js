// src/lib/wallet-config.js
'use client';

import { http, createConfig } from 'wagmi';
import { base, baseSepolia /* , mainnet */ } from 'wagmi/chains';
import { coinbaseWallet, injected, metaMask, walletConnect } from 'wagmi/connectors';

const WC_ID  = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID; // <-- NOT the CDP ID
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const config = createConfig({
  // keep the chains you actually support
  chains: [base, baseSepolia /* , mainnet */],

  transports: {
    [base.id]: http(process.env.NEXT_PUBLIC_BASE_MAINNET_RPC || 'https://mainnet.base.org'),
    [baseSepolia.id]: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || 'https://sepolia.base.org'),
    // [mainnet.id]: http(process.env.NEXT_PUBLIC_ETH_MAINNET_RPC || 'https://ethereum.publicnode.com'),
  },

  connectors: [
    injected(),
    metaMask(),
    coinbaseWallet({
      appName: 'Vertify',
      // 'all' lets users pick Smart Wallet or regular CB Wallet.
      // use 'smartWalletOnly' if you want to force Smart Wallet.
      preference: 'all',
    }),
    ...(WC_ID ? [
      walletConnect({
        projectId: WC_ID,
        metadata: {
          name: 'Vertify',
          description: 'Decentralized fact-checking on Base',
          url: APP_URL,
          icons: ['https://fav.farm/⚖️'],
        },
        // showQrModal: true, // optional
      })
    ] : []), // no WalletConnect initialized if you don't have a real ID
  ],

  ssr: true,
});
