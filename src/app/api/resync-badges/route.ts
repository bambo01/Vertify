import { NextResponse } from "next/server";
import { ethers } from "ethers";

export const runtime = "nodejs";

const RPC = process.env.RPC_URL!;
const ROLE_BADGE_NFT = process.env.NEXT_PUBLIC_ROLE_BADGE_NFT_ADDRESS!;

// minimal read ABI
const roleBadgeAbi = [
  "function getUserBadge(address _user, uint8 _category) view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];

// Must match your Solidity enums
const CATEGORY = { Tech: 0, Health: 1, Politics: 2, Finance: 3, Science: 4 } as const;
const CATEGORY_BY_INDEX = Object.fromEntries(
  Object.entries(CATEGORY).map(([k, v]) => [v, k])
) as Record<number, string>;

export async function POST(req: Request) {
  try {
    const { address } = await req.json();
    if (!address) {
      return NextResponse.json({ error: "Missing address" }, { status: 400 });
    }
    if (!RPC || !ROLE_BADGE_NFT) {
      return NextResponse.json({ error: "Server misconfigured (RPC or contract address missing)" }, { status: 500 });
    }

    const provider = new ethers.JsonRpcProvider(RPC);
    const nft = new ethers.Contract(ROLE_BADGE_NFT, roleBadgeAbi, provider);

    const results: Array<{ category: string; tokenId: string; txHash: string | null }> = [];

    // probe every category by calling getUserBadge(user, index)
    for (const idx of Object.values(CATEGORY)) {
      try {
        const tokenIdBN = await nft.getUserBadge(address, idx);
        const tokenIdStr = tokenIdBN?.toString?.() ?? "0";
        if (tokenIdStr !== "0") {
          // try to find the first Transfer(to=address, tokenId) to attach a txHash
          let txHash: string | null = null;
          try {
            // ethers v6: build an event filter and fetch logs
            const filter = nft.filters.Transfer(null, address, tokenIdBN);
            const logs = await provider.getLogs({
              ...filter,
              fromBlock: 0n,
              toBlock: "latest",
            });
            txHash = logs?.[0]?.transactionHash ?? null;
          } catch {
            /* ignore */
          }

          results.push({
            category: CATEGORY_BY_INDEX[Number(idx)],
            tokenId: tokenIdStr,
            txHash,
          });
        }
      } catch {
        /* ignore per-category read errors */
      }
    }

    return NextResponse.json({ ok: true, badges: results });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to resync from chain" },
      { status: 500 }
    );
  }
}
