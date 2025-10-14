'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Wallet, LogOut } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function WalletConnect() {
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();

  const formatAddress = (addr) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  if (isConnected && address) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="gap-2 border-gray-300 text-gray-800 dark:border-gray-700 dark:text-gray-100 dark:bg-gray-900"
          >
            <Wallet className="h-4 w-4" />
            {formatAddress(address)}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-48 border border-gray-200 bg-white text-gray-900 shadow-md dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
        >
          <DropdownMenuItem
            onClick={() => disconnect()}
            className="cursor-pointer focus:bg-gray-100 dark:focus:bg-gray-800"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="gap-2 bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500">
          <Wallet className="h-4 w-4" />
          Connect Wallet
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-56 border border-gray-200 bg-white text-gray-900 shadow-md dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
      >
        {connectors.map((connector) => (
          <DropdownMenuItem
            key={connector.id}
            onClick={() => connect({ connector })}
            className="cursor-pointer focus:bg-gray-100 dark:focus:bg-gray-800"
          >
            {connector.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function WalletRequired({ children }) {
  const { isConnected } = useAccount();

  if (!isConnected) {
    return (
      <Card className="mx-auto mt-12 max-w-md border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <CardContent className="pt-6 text-center">
          <Wallet className="mx-auto mb-4 h-12 w-12 text-blue-600 dark:text-blue-500" />
          <h2 className="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            Wallet Required
          </h2>
          <p className="mb-4 text-gray-600 dark:text-gray-300">
            Please connect your wallet to access this feature.
          </p>
          <WalletConnect />
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
