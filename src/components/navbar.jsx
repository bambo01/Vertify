'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WalletConnect } from './wallet-connect';
import { Shield, Home, Plus, Search, User } from 'lucide-react';
import { Button } from './ui/button';

export function Navbar() {
  const pathname = usePathname();

  const isActive = (path) => pathname === path;

  return (
    <nav className="border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-2xl font-bold">
            <Shield className="h-7 w-7 text-blue-600" />
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Vertify
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-2">
            <Link href="/">
              <Button
                variant={isActive('/') ? 'navbar' : 'ghost'}
                className="gap-2"
              >
                <Home className="h-4 w-4" />
                Home
              </Button>
            </Link>
            <Link href="/explore">
              <Button
                variant={isActive('/explore') ? 'navbar' : 'ghost'}
                className="gap-2"
              >
                <Search className="h-4 w-4" />
                Explore
              </Button>
            </Link>
            {/*<Link href="/submit">
              <Button
                variant={isActive('/submit') ? 'default' : 'ghost'}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Submit
              </Button>
            </Link>*/}
            <Link href="/dashboard">
              <Button
                variant={isActive('/dashboard') ? 'navbar' : 'ghost'}
                className="gap-2"
              >
                <User className="h-4 w-4" />
                Dashboard
              </Button>
            </Link>
          </div>

          <WalletConnect />
        </div>

        <div className="md:hidden flex items-center gap-2 mt-3">
          <Link href="/" className="flex-1">
            <Button
              variant={isActive('/') ? 'default' : 'ghost'}
              className="w-full gap-2"
              size="sm"
            >
              <Home className="h-4 w-4" />
              Home
            </Button>
          </Link>
          <Link href="/explore" className="flex-1">
            <Button
              variant={isActive('/explore') ? 'default' : 'ghost'}
              className="w-full gap-2"
              size="sm"
            >
              <Search className="h-4 w-4" />
              Explore
            </Button>
          </Link>
          <Link href="/submit" className="flex-1">
            <Button
              variant={isActive('/submit') ? 'default' : 'ghost'}
              className="w-full gap-2"
              size="sm"
            >
              <Plus className="h-4 w-4" />
              Submit
            </Button>
          </Link>
          <Link href="/dashboard" className="flex-1">
            <Button
              variant={isActive('/dashboard') ? 'default' : 'ghost'}
              className="w-full gap-2"
              size="sm"
            >
              <User className="h-4 w-4" />
              Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
