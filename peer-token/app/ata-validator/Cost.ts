import {
    Connection,
    Keypair,
    PublicKey,
    LAMPORTS_PER_SOL,
  } from "@solana/web3.js";
  import fetch from "node-fetch";
//   import { get } from "@orca-so/sdk"; // Assumes orca SDK utility or manual fetch
  
  const connection = new Connection("https://api.devnet.solana.com");
  
// 1. Get recent transaction fee (F_SOL)
// async function getTransferFeeSOL(): Promise<number> {
//   const latestBlockhash = await connection.getLatestBlockhash();
//   const feeCalculator = await connection.getFeeCalculatorForBlockhash(latestBlockhash.blockhash);
//   const lamports = feeCalculator.value?.lamportsPerSignature ?? 5000; // fallback
//   return lamports / LAMPORTS_PER_SOL;
// }
  
// 2. Get SOL price in EUR from CoinGecko (P_SOL)
async function getSolPriceEUR(): Promise<number> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=eur"
    );
    const data = await res.json();
    return data["solana"]["eur"];
  } catch (e) {
    console.error("Failed to fetch SOL price from CoinGecko", e);
    return 0;
  }
}
  
// 3. Get Peer token price in EUR (P_Peer)
async function getPeerTokenPriceEUR(): Promise<number> {
  // Simulate a token price of 0.10 EUR for testing purposes
  return 0.05;
}
  
  // 4. Calculate Deducted_Peer_Tokens
  async function calculateDeduction(N: number = 1) {
    // const F_SOL = await getTransferFeeSOL(); // e.g. 0.000005 SOL
    const F_SOL = 0.00001;
    const P_SOL = await getSolPriceEUR();    // e.g. 120 EUR
    const P_Peer = await getPeerTokenPriceEUR(); // e.g. 0.10 EUR per Peer token
  
    const Deducted_Peer_Tokens = (N * F_SOL * P_SOL) / P_Peer;

    const Final_Peer_Tokens = 5000-Deducted_Peer_Tokens 
  
    console.log("📌 Transfer Fee (F_SOL):", F_SOL.toFixed(8), "SOL");
    console.log("💶 SOL Price (P_SOL): €", P_SOL.toFixed(2));
    console.log("🪙 Peer Token Price (P_Peer): €", P_Peer.toFixed(6));
    console.log("🔻 Deducted Peer Tokens:", Deducted_Peer_Tokens.toFixed(6));
    console.log("🔻 Final Peer Tokens:", Final_Peer_Tokens.toFixed(6));

    distributePeerTokens(Final_Peer_Tokens, await calculateATAFeesInPeerTokens());
  }
  
  import fs from "fs";

const userGems: Record<string, number> = {};
Array.from({ length: 20 }).forEach((_, i) => {
  const pubkey = Keypair.generate().publicKey.toBase58();
  userGems[pubkey] = [5, 0.25, 3, 1, 10, 20, 100, 30, 8, 50, 80, 15, 12, 16, 25, 2, 4, 6, 0.75, 12][i];
});

function distributePeerTokens(finalTokens: number, peerTokensNeeded: number) {
  const totalGems = Object.values(userGems).reduce((sum, val) => sum + val, 0);
  const distribution: Record<string, number> = {};

  for (const [user, gems] of Object.entries(userGems)) {
    const share = (gems / totalGems) * finalTokens;
    distribution[user] = parseFloat(share.toFixed(6));
  }

  console.log("📤 Distribution of Peer Tokens:");
  const tableData = Object.entries(distribution).map(([pubkey, tokens], index) => ({
    User: `User ${index + 1}`,
    Pubkey: pubkey,
    Gems: userGems[pubkey],
    "Peer Tokens": tokens,
  }));

  console.table(tableData);

  const extendedTable = tableData.map(row => {
    const hasTokenAccount = Math.random() < 0.5;
    const canAffordATA = row["Peer Tokens"] >= peerTokensNeeded;
    let adjustedTokens = row["Peer Tokens"];
    let routingDecision = "To User Wallet";
    let note = "";

    if (!hasTokenAccount) {
      if (!canAffordATA) {
        note = "(To Storage Wallet)";
        routingDecision = "To Storage Wallet";
      } else {
        adjustedTokens = parseFloat((adjustedTokens - peerTokensNeeded).toFixed(6));
      }
    } else {
      adjustedTokens = parseFloat(adjustedTokens.toFixed(6));
    }

    return {
      ...row,
      "Has Token Account": hasTokenAccount,
      "Final Peer Tokens": adjustedTokens,
      "Routing Decision": routingDecision
    };
  });
  console.log("\n📄 Extended Token Distribution Table:");
  console.table(extendedTable);
  const totalTokens = Object.values(distribution).reduce((a, b) => a + b, 0);
  console.log("🔢 Total Distributed Peer Tokens:", totalTokens.toFixed(6));

  fs.writeFileSync("Gem.json", JSON.stringify(distribution, null, 2));
}

calculateDeduction(20); // You can pass N = number of transfers

// 5. Calculate how many Peer Tokens are needed to create an associated token account (ATA)
async function calculateATAFeesInPeerTokens() {
  const rentLamports = await connection.getMinimumBalanceForRentExemption(165); // ATA size in bytes
  const rentSOL = rentLamports / LAMPORTS_PER_SOL;
  const solPriceEUR = await getSolPriceEUR();
  const peerTokenPriceEUR = await getPeerTokenPriceEUR();

  const rentEUR = rentSOL * solPriceEUR;
  // already correct value
  const peerTokensNeeded = rentEUR / peerTokenPriceEUR;

  console.log("🏦 Rent-exempt cost for ATA:");
  console.log("🔹", rentSOL.toFixed(8), "SOL");
  console.log("💶", rentEUR.toFixed(4), "EUR");
  console.log("🪙 Peer Tokens required to create ATA:", peerTokensNeeded.toFixed(6));

  return peerTokensNeeded;
}

// Optional: Call it after other calculations
calculateATAFeesInPeerTokens();
