import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Connection, Keypair, SystemProgram, clusterApiUrl } from "@solana/web3.js";
import { 
    TOKEN_2022_PROGRAM_ID,
    getMint
} from "@solana/spl-token";
import * as fs from 'fs';
import * as path from 'path';

// Set up the program ID (update with your deployed program ID)
const PROGRAM_ID = new PublicKey("HuEiNnujaKX3vnhVn8wU8vQ6wDjoQh2xYAD7FhZcS2RQ");

async function main() {
    try {
        console.log("\n🚀 Starting token mint test...");
        
        // Set up connection and wallet
        const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
        
        // Load wallet from keypair file
        const keypairPath = "/Users/macbookpro/Solana/keys/wallet.json";
        const keypair = Keypair.fromSecretKey(
            Buffer.from(JSON.parse(fs.readFileSync(keypairPath, "utf-8")))
        );
        console.log("\n💳 Using wallet:", keypair.publicKey.toString());

        // Create provider
        const provider = new anchor.AnchorProvider(
            connection,
            new anchor.Wallet(keypair),
            { commitment: "confirmed" }
        );
        anchor.setProvider(provider);

        // Load the IDL from the local file
        const idlPath = path.join(process.cwd(), "target", "idl", "peer_token.json");
        const idlFile = fs.readFileSync(idlPath, 'utf8');
        const idl = JSON.parse(idlFile);

        // Create program interface
        const program = new anchor.Program(idl, PROGRAM_ID, provider);

        console.log("\n====================================");
        console.log("🔄 Testing Peer Token Mint Creation");
        console.log("====================================");
        console.log("🔹 Program ID:", PROGRAM_ID.toString());
        
        // Derive the token mint PDA
        const [mintPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("peer-token")],
            PROGRAM_ID
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
                console.log("❌ Could not fetch detailed mint info:", error.message);
            }
        } else {
            console.log("❓ Mint account does not exist. Creating it now...");

            // Create the token mint
            const tx = await program.methods
                .createToken()
                .accounts({
                    peerAuthority: keypair.publicKey,
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
                    console.log("❌ Could not fetch detailed mint info:", error.message);
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
