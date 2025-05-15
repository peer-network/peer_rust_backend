import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Connection, Keypair, SystemProgram, clusterApiUrl } from "@solana/web3.js";
import { 
    TOKEN_2022_PROGRAM_ID,
    getMint
} from "@solana/spl-token";
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { getPublicKey, getSolanaConnection, getKeypairFromEnvPath, getIdl } from "../../utilss";
dotenv.config();

// Set up the program ID (update with your deployed program ID)
const program_id = getPublicKey("PROGRAM_ID");
const companyWallet = getKeypairFromEnvPath("COMPANY_WALLET_PATH");
const connection = getSolanaConnection();
const idl = getIdl();

async function main() {
    try {
        console.log("\n🚀 Starting token mint test...");
        
        
        // Create provider
        const provider = new anchor.AnchorProvider(
            connection,
            new anchor.Wallet(companyWallet),
            { commitment: "confirmed" }
        );
        anchor.setProvider(provider);


        // Create program interface
        const program = new anchor.Program(idl, program_id, provider);

        console.log("\n====================================");
        console.log("🔄 Testing Peer Token Mint Creation");
        console.log("====================================");
        console.log("🔹 Program ID:", program_id.toString());
        
        // Derive the token mint PDA
        const [mintPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("peer-token")],
            program_id
        );
        
        console.log("🔹 Mint PDA:", mintPda.toString());

        // Check if mint already exists
        console.log("\n🔍 Checking if mint already exists...");
        const mintAccountInfo = await connection.getAccountInfo(mintPda);
        
        if (mintAccountInfo) {
            console.log("✅ Mint account already exists!");
            console.log("🔹 Mint Account Size:", mintAccountInfo.data.length);
            console.log("🔹 Mint Account Owner:", mintAccountInfo.owner.toString());
            
            try {
                // Get token mint info
                const mintInfo = await getMint(
                    connection,
                    mintPda,
                    "confirmed",
                    TOKEN_2022_PROGRAM_ID
                );
                console.log("🔹 Token Supply:", mintInfo.supply.toString());
                console.log("🔹 Decimals:", mintInfo.decimals);
                console.log("🔹 Mint Authority:", mintInfo.mintAuthority?.toString() || "None");
                console.log("🔹 Freeze Authority:", mintInfo.freezeAuthority?.toString() || "None");
            } catch (error) {
                console.log("❌ Could not fetch detailed mint info:", error instanceof Error ? error.message : error);
            }
        } else {
            console.log("❓ Mint account does not exist. Creating it now...");

            // Create the token mint
            const tx = await program.methods
                .createToken()
                .accounts({
                    peerAuthority: companyWallet.publicKey,
                    peerMint: mintPda,
                    systemProgram: SystemProgram.programId,
                    tokenProgram: TOKEN_2022_PROGRAM_ID,
                    rent: anchor.web3.SYSVAR_RENT_PUBKEY
                })
                .rpc();
            
            console.log("✅ Token mint created successfully");
            console.log("🔹 Transaction:", tx);
            console.log("🔹 Explorer URL:", `https://explorer.solana.com/tx/${tx}?cluster=devnet`);
            
            // Verify the mint was created
            console.log("\n🔍 Verifying mint creation...");
            const mintInfo = await connection.getAccountInfo(mintPda);
            console.log("✅ Mint Account Created:", mintInfo !== null);
            
            if (mintInfo) {
                try {
                    // Get token mint info
                    const tokenMintInfo = await getMint(
                        connection,
                        mintPda,
                        "confirmed",
                        TOKEN_2022_PROGRAM_ID
                    );
                    console.log("🔹 Token Decimals:", tokenMintInfo.decimals);
                    console.log("🔹 Mint Authority:", tokenMintInfo.mintAuthority?.toString());
                    console.log("🔹 Freeze Authority:", tokenMintInfo.freezeAuthority?.toString());
                } catch (error) {
                    console.log("❌ Could not fetch detailed mint info:", error instanceof Error ? error.message : error);
                }
            }
        }
    } catch (error) {
        console.error("\n❌ ERROR:", error);
        if (error instanceof Error) {
            console.error("Error message:", error.message);
            console.error("Error stack:", error.stack);
        }
    }
}

main().then(() => console.log("\n✨ Done"));
