import * as anchor from "@coral-xyz/anchor";
import { Metaplex, keypairIdentity } from "@metaplex-foundation/js";
import { Connection, Keypair, PublicKey, clusterApiUrl } from "@solana/web3.js";
import * as fs from 'fs';

async function updateTokenMetadata() {
  // Set up connection to devnet
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  
  // Load your wallet
  const keypairData = JSON.parse(fs.readFileSync('/Users/macbookpro/Solana/keys/wallet.json', 'utf-8'));
  const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
  
  // Create Metaplex instance
  const metaplex = new Metaplex(connection);
  metaplex.use(keypairIdentity(keypair));
  
  // Your token mint address
  const mint = new PublicKey("828jtg9bQM5PycvtoWagAZVHiKp9DmRvziMM4FtaRv1M");
  
  console.log("Fetching token metadata...");
  const token = await metaplex.nfts().findByMint({ mintAddress: mint });
  
  console.log("Current metadata URI:", token.uri);
  
  console.log("Updating token metadata...");
  // Update to use the JSON URL instead of the image URL
  const metadataUrl = "https://raw.githubusercontent.com/utkuurkun/peer-token-metadata/refs/heads/main/token.json";
  
  const updateResult = await metaplex.nfts().update({
    nftOrSft: token,
    uri: metadataUrl,
  });
  
  console.log("Metadata updated successfully!");
  console.log("Transaction signature:", updateResult.response.signature);
}

updateTokenMetadata().catch(console.error); 