// src/components/admin/AdminGuard.jsx
'use client';

import { useAccount } from 'wagmi';
import { WalletRequired } from '@/components/wallet-connect';
import { Card, CardContent } from '@/components/ui/card';

export default function AdminGuard({ children, adminAddress }) {
  const { isConnected, address } = useAccount();

  if (!isConnected) return <WalletRequired>{null}</WalletRequired>;

  const ok =
    address && adminAddress &&
    address.toLowerCase() === adminAddress.toLowerCase();

  if (!ok) {
    return (
      <div className="container mx-auto max-w-xl p-6">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-lg font-semibold">Not authorized</p>
            <p className="text-gray-600">This page is only for administrators.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
