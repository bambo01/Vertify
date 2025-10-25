'use client';

import { useEffect } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Wallet, LogOut } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const ADMIN_ADDRESS = '0x42C31Db2d6B12D5CD81e23d33eab7Abf49188E35';
const ADMIN_ROUTE = '/admin'; // or `/admin${ADMIN_ADDRESS}` or `/admin0x42C31Db2d6B12D5CD81e23d33eab7Abf49188E35`

export function WalletConnect() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();

  const formatAddress = (addr) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  // Redirect when the admin wallet is connected
  useEffect(() => {
    if (!isConnected || !address) return;
    if (address.toLowerCase() === ADMIN_ADDRESS.toLowerCase()) {
      router.replace(ADMIN_ROUTE);
    }
  }, [isConnected, address, router]);

  if (isConnected && address) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            className="gap-2 bg-[#3563E9] text-white  dark:border-gray-700 dark:text-gray-100 dark:bg-gray-900 hover:shadow-lg"
          >
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
        <Button className="gap-2 bg-[#3563E9] text-white hover:bg-blue-700 dark:bg-[#3563E9] dark:hover:bg-blue-500">
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
  const router = useRouter();
  const { isConnected, address } = useAccount();

  // Optional: also guard/redirect here if the wrapper is used on protected pages
  useEffect(() => {
    if (isConnected && address?.toLowerCase() === ADMIN_ADDRESS.toLowerCase()) {
      router.replace(ADMIN_ROUTE);
    }
  }, [isConnected, address, router]);

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
