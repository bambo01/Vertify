import { Inter } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/providers/wallet-provider";
import { Navbar } from "@/components/navbar";
import { Toaster } from "@/components/ui/sonner";
import FarcasterWrapper from "@/components/FarcasterWrapper";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <WalletProvider>
          <Navbar />
          <main className="min-h-screen bg-white">
            <FarcasterWrapper>{children}</FarcasterWrapper>
          </main>
          <Toaster />
        </WalletProvider>
      </body>
    </html>
  );
}

export const metadata = {
  title: "TruthChain Verify",
  description:
    "Anchor and verify community fact-checks on-chain, rewarding accuracy while curbing misinformation spread. Stake, vote, and earn on trusted, transparent outcomes.",
  other: {
    "fc:frame": JSON.stringify({
      version: "next",
      imageUrl:
        "https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/thumbnail_ec2b72f7-d826-4d0d-a7d9-70bdf575a8e5-sMEWyTR9qAzPmzzDJFSHxO5Uw7ZT9Y",
      button: {
        title: "Open with Ohara",
        action: {
          type: "launch_frame",
          name: "TruthChain Verify",
          url: "https://food-hidden-841.app.ohara.ai",
          splashImageUrl:
            "https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/farcaster/splash_images/splash_image1.svg",
          splashBackgroundColor: "#ffffff",
        },
      },
    }),
  },
};
