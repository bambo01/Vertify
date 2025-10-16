import { NextResponse } from "next/server";
import { ethers } from "ethers";

export const runtime = "nodejs";

const RPC = process.env.RPC_URL!;
const ROLE_BADGE_NFT = process.env.NEXT_PUBLIC_ROLE_BADGE_NFT_ADDRESS!;

const roleBadgeAbi = [
  "function getUserBadge(address _user, uint8 _category) view returns (uint256)"
];

const CATEGORY = { Tech: 0, Health: 1, Politics: 2, Finance: 3, Science: 4 } as const;
const CAT_NAMES = Object.keys(CATEGORY) as (keyof typeof CATEGORY)[];

const TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");
const ZERO_ADDR_32   = ethers.zeroPadValue("0x0000000000000000000000000000000000000000", 32);
const addrTopic = (a: string) => ethers.zeroPadValue(ethers.getAddress(a), 32);
const u256Topic = (n: bigint) => ethers.zeroPadValue(ethers.toBeHex(n), 32);

export async function POST(req: Request) {
  try {
    const { address, lookbackBlocks = 200_000 } = await req.json();
    if (!address) {
      return NextResponse.json({ error: "Missing 'address'" }, { status: 400 });
    }

    const provider = new ethers.JsonRpcProvider(RPC);
    const nft = new ethers.Contract(ROLE_BADGE_NFT, roleBadgeAbi, provider);

    const latest = await provider.getBlockNumber();
    const fromBlock = Math.max(0, latest - Number(lookbackBlocks));

    const minted: Array<{category: string; tokenId: string; txHash: string | null; block: number | null}> = [];

    for (const cat of CAT_NAMES) {
      let tokenId: bigint | null = null;
      try {
        const id: bigint = await nft.getUserBadge(address, CATEGORY[cat]);
        if (id && id !== 0n) tokenId = id;
      } catch { /* ignore if your function reverts when none */ }

      if (!tokenId) continue;

      // Try to find the original mint tx
      let txHash: string | null = null;
      let block: number | null = null;

      try {
        const logs = await provider.getLogs({
          address: ROLE_BADGE_NFT,
          fromBlock,
          toBlock: "latest",
          topics: [TRANSFER_TOPIC, ZERO_ADDR_32, addrTopic(address), u256Topic(tokenId)],
        });
        if (logs[0]) {
          txHash = logs[0].transactionHash;
          block  = logs[0].blockNumber;
        }
      } catch { /* best effort */ }

      minted.push({ category: cat, tokenId: tokenId.toString(), txHash, block });
    }

    return NextResponse.json({ ok: true, minted });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Resync failed" }, { status: 500 });
  }
}
