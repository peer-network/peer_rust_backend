import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  PublicKey,
  Connection,
  Keypair,
  SystemProgram,
  clusterApiUrl,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getMint,
  unpackAccount,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";
import { BN } from "bn.js";
import {
  getPublicKey,
  getKeypairFromEnvPath,
  getSolanaConnection,
  getIdl,
  getTokenDecimals,
  getDailyMintAmount,
} from "../../utilss";
import { tokenDistribution } from "../mockdata/distribution";

const connection = getSolanaConnection();
const companyWallet = getKeypairFromEnvPath("COMPANY_WALLET_PATH");
const idl = getIdl();
const token_decimals = getTokenDecimals("TOKEN_DECIMALS");
const daily_mint_amount = getDailyMintAmount("DAILY_MINT_AMOUNT");
const program_id = getPublicKey("PROGRAM_ID");

export interface TokenDistribution {
  data: {
    GetGemsForDay: {
      status: string;
      ResponseCode: string;
      Date: string;
      affectedRows: {
        data: Array<{
          userId?: string;
          walletAddress?: string;
          tokens?: string;
        }>;
        totalTokens?: string;
      };
    };
  };
}

async function mintToCompany(
  program: Program,
  connection: Connection,
  companyKeypair: Keypair,
  mintPda: PublicKey,
  companyTokenAccount: PublicKey
): Promise<void> {
    console.log("\n🚀 Step 1: Daily Minting to Company Account");

    // Derive the last mint account PDA
    const [lastMintPda] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("daily-mint"),
            companyKeypair.publicKey.toBuffer()
        ],
        program_id
    );
    console.log("🔹 Last Mint PDA:", lastMintPda.toString());

    // Amount to mint (5000 tokens with 9 decimals)
    const amount = daily_mint_amount * (10 ** token_decimals);

    try {
        const tx = await program.methods
            .dailyMint(new BN(amount))
            .accounts({
                peerAuthority: companyKeypair.publicKey,
                peerMint: mintPda,
                peerTokenAccount: companyTokenAccount,
                lastMint: lastMintPda,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                systemProgram: SystemProgram.programId
            })
            .signers([companyKeypair])
            .rpc();
            
        console.log("✅ Daily mint successful");
        console.log("🔹 Transaction:", tx);
        console.log("🔹 Explorer URL:", `https://explorer.solana.com/tx/${tx}?cluster=devnet`);
        
        // Verify the mint
        const tokenAccountInfo = await connection.getTokenAccountBalance(companyTokenAccount);
        console.log("\n💰 Company Token Balance:", tokenAccountInfo.value.uiAmount);
    } catch (error) {
        if (error instanceof Error && error.message.includes("AlreadyMintedToday")) {
            console.log("ℹ️ Tokens have already been minted today. Proceeding with distribution.");
        } else {
            throw error;
        }
    }
}

async function createUserTokenAccounts(
  program: Program,
  connection: Connection,
  companyKeypair: Keypair,
  mintPda: PublicKey,
  distributions: TokenDistribution["data"]["GetGemsForDay"]["affectedRows"]["data"]
): Promise<void> {
  // ... Token account creation logic
}

async function distributeTokens(
  program: Program,
  connection: Connection,
  companyKeypair: Keypair,
  mintPda: PublicKey,
  companyTokenAccount: PublicKey,
  distributions: TokenDistribution["data"]["GetGemsForDay"]["affectedRows"]["data"]
): Promise<void> {
  // ... Distribution logic
}

async function main() {
  try {
    const connection = getSolanaConnection();
    console.log("\n💼 Company wallet:", companyWallet.publicKey.toString());

    const provider = new anchor.AnchorProvider(
      connection,
      new anchor.Wallet(companyWallet),
      { commitment: "confirmed" }
    );
    anchor.setProvider(provider);

    const program = new anchor.Program(idl, program_id, provider);

    const [mintPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("peer-token")],
      program_id
    );
    console.log("\n🔹 Mint PDA:", mintPda.toString());

    const companyTokenAccount = getAssociatedTokenAddressSync(
      mintPda,
      companyWallet.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID
    );
    console.log("🔹 Company Token Account:", companyTokenAccount.toString());

    const distributionPath = path.join(
      process.cwd(),
      "peer-token",
      "app",
      "ata-validator",
      "data",
      "TokenDistribution.json"
    );
    console.log("\n🔍 Loading TokenDistribution.json from:", distributionPath);

    if (!fs.existsSync(distributionPath)) {
      throw new Error(`❌ TokenDistribution.json not found at: ${distributionPath}`);
    }

    const distributionData: TokenDistribution = JSON.parse(
      fs.readFileSync(distributionPath, "utf8")
    );
    console.log(
      `📊 Total distributions to process: ${distributionData.data.GetGemsForDay.affectedRows.data.length}`
    );

    await mintToCompany(
      program,
      connection,
      companyWallet,
      mintPda,
      companyTokenAccount
    );
    await createUserTokenAccounts(
      program,
      connection,
      companyWallet,
      mintPda,
      distributionData.data.GetGemsForDay.affectedRows.data
    );
    await distributeTokens(
      program,
      connection,
      companyWallet,
      mintPda,
      companyTokenAccount,
      distributionData.data.GetGemsForDay.affectedRows.data
    );

    console.log("\n📝 SUMMARY:");
    console.log(
      `Total distributions completed: ${distributionData.data.GetGemsForDay.affectedRows.data.length}`
    );
    console.log(
      `Total tokens distributed: ${distributionData.data.GetGemsForDay.affectedRows.totalTokens}`
    );
  } catch (error) {
    console.error("\n❌ ERROR:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
  }
}

main().then(() => console.log("\n✨ Complete token distribution process finished"));
