import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";

const RPC_URL = "https://api.devnet.solana.com"; // Use mainnet if needed

// Replace with your wallet and mint addresses
const wallet = new PublicKey("CGELnVFsbEJUvEW4rVmmJEvxSQkRH9e4x6eiRU3JfHne");
const mint = new PublicKey("HBSPMFVXL5G7Ni5kjtoAdbvbpq2Mo7BF3V2HP5AWsTaN");

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");

  // 1. Derive the Associated Token Account address (ATA)
  const ata = await getAssociatedTokenAddress(
    mint,
    wallet,
    false, // allowOwnerOffCurve (should be false unless you have a multisig or PDA)
  );
  console.log("Derived ATA:", ata.toBase58());

  // 2. Check if it exists
  const accountInfo = await connection.getAccountInfo(ata);

  if (accountInfo && accountInfo.owner.equals(new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"))) {
    console.log("✅ SPL Token account exists!");
  } else if (accountInfo) {
    console.log("⚠️ Account exists but is NOT a token account!");
  } else {
    console.log("❌ Account does not exist!");
  }
}

main().catch(console.error);