"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "./ui/button";
import { WalletConnect } from "./wallet-connect";
import ThemeToggle from "@/components/theme-toggle"; // ⬅️ import (adjust path if needed)

export function Navbar() {
  const pathname = usePathname();
  const isActive = (path) => pathname === path;

  return (
    <nav className="border-b bg-white dark:bg-[#1A2745] sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* left: logo */}
          <Link href="/" className="flex items-center gap-2 text-2xl font-bold">
            <span className="text-[#227DC3] dark:text-white font-semibold">
              Vertify
            </span>
          </Link>

          {/* center: desktop nav */}
          <div className="hidden md:flex items-center gap-2">
            <Link href="/">
              <Button variant={isActive("/") ? "navbar" : "ghost"} className="gap-2">Home</Button>
            </Link>
            <Link href="/explore">
              <Button variant={isActive("/explore") ? "navbar" : "ghost"} className="gap-2">Explore</Button>
            </Link>
            <Link href="/dashboard">
              <Button variant={isActive("/dashboard") ? "navbar" : "ghost"} className="gap-2">Dashboard</Button>
            </Link>
          </div>

          {/* right: theme + wallet (desktop) */}
          <div className="hidden md:flex items-center gap-3">
            
            <WalletConnect />
            <ThemeToggle />
          </div>

          {/* right: wallet only on very small screens (optional) */}
          <div className="md:hidden">
            <WalletConnect />
          </div>
        </div>

        {/* mobile nav row + theme toggle */}
        <div className="md:hidden flex items-center gap-2 mt-3">
          <Link href="/" className="flex-1">
            <Button variant={isActive("/") ? "navbar" : "ghost"} className="w-full gap-2" size="sm">Home</Button>
          </Link>
          <Link href="/explore" className="flex-1">
            <Button variant={isActive("/explore") ? "navbar" : "ghost"} className="w-full gap-2" size="sm">Explore</Button>
          </Link>
          <Link href="/dashboard" className="flex-1">
            <Button variant={isActive("/dashboard") ? "navbar" : "ghost"} className="w-full gap-2" size="sm">Dashboard</Button>
          </Link>

          {/* theme toggle on mobile too */}
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
