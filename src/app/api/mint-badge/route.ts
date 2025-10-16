// src/app/api/mint-badge/route.ts
import { NextResponse } from "next/server";
import { JsonRpcProvider, Wallet, Contract } from "ethers";

export const runtime = "nodejs";

const RPC = process.env.RPC_URL!;
const OWNER_PK = process.env.NFT_OWNER_PRIVATE_KEY!;
const ROLE_BADGE_NFT = process.env.NEXT_PUBLIC_ROLE_BADGE_NFT_ADDRESS!;

const roleBadgeAbi = [
  "function owner() view returns (address)",
  "function mintBadge(address _holder, uint8 _category, uint8 _tier) returns (uint256)",
  "function getUserBadge(address _user, uint8 _category) view returns (uint256)"
];

const CATEGORY = { Tech: 0, Health: 1, Politics: 2, Finance: 3, Science: 4 } as const;
const TIER = { Silver: 0, Gold: 1, Expert: 2 } as const;

export async function POST(req: Request) {
  try {
    const { to, category, tier = "Silver" } = await req.json();

    if (!RPC || !OWNER_PK || !ROLE_BADGE_NFT) {
      return NextResponse.json({ error: "Missing envs (RPC_URL / NFT_OWNER_PRIVATE_KEY / NEXT_PUBLIC_ROLE_BADGE_NFT_ADDRESS)" }, { status: 500 });
    }
    if (!to || !category) {
      return NextResponse.json({ error: "Missing 'to' or 'category'" }, { status: 400 });
    }

    const catIdx = CATEGORY[category as keyof typeof CATEGORY];
    const tierIdx = TIER[tier as keyof typeof TIER];
    if (catIdx === undefined) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    const provider = new JsonRpcProvider(RPC);
    const wallet = new Wallet(OWNER_PK, provider);
    const nft = new Contract(ROLE_BADGE_NFT, roleBadgeAbi, wallet);

    const ownerAddr: string = await nft.owner();
    if (ownerAddr.toLowerCase() !== wallet.address.toLowerCase()) {
      return NextResponse.json({ error: "Server wallet is not the NFT owner" }, { status: 403 });
    }

    const tx = await nft.mintBadge(to, catIdx, tierIdx);
    const rc = await tx.wait();
    const tokenId = await nft.getUserBadge(to, catIdx);

    return NextResponse.json({
      ok: true,
      txHash: tx.hash,
      block: rc?.blockNumber ?? null,
      tokenId: tokenId?.toString?.() ?? null
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.reason || e?.shortMessage || e?.message || "Mint failed" }, { status: 500 });
  }
}
