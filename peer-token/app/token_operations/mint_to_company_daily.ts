import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Connection, Keypair, SystemProgram, clusterApiUrl } from "@solana/web3.js";
import { 
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddressSync
} from "@solana/spl-token";
import * as fs from 'fs';
import * as path from 'path';

// Set up the program ID
const PROGRAM_ID = new PublicKey("HuEiNnujaKX3vnhVn8wU8vQ6wDjoQh2xYAD7FhZcS2RQ");

async function main() {
    try {
        console.log("\n🚀 Starting daily token minting to company account...");
        
        // Set up connection
        const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
        
        // Load company wallet keypair
        const companyKeypairPath = "/Users/macbookpro/Solana/keys/wallet.json";
        const companyKeypair = Keypair.fromSecretKey(
            Buffer.from(JSON.parse(fs.readFileSync(companyKeypairPath, "utf-8")))
        );
        console.log("\n💼 Company wallet:", companyKeypair.publicKey.toString());

        // Create provider with company wallet
        const provider = new anchor.AnchorProvider(
            connection,
            new anchor.Wallet(companyKeypair),
            { commitment: "confirmed" }
        );
        anchor.setProvider(provider);

        // Load the IDL
        const idlPath = path.join(process.cwd(), "target", "idl", "peer_token.json");
        const idlFile = fs.readFileSync(idlPath, 'utf8');
        const idl = JSON.parse(idlFile);

        // Create program interface
        const program = new anchor.Program(idl, PROGRAM_ID, provider);

        // Derive the token mint PDA
        const [mintPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("peer-token")],
            PROGRAM_ID
        );
        console.log("\n🔹 Mint PDA:", mintPda.toString());

        // Get company's token account address
        const companyTokenAccount = getAssociatedTokenAddressSync(
            mintPda,
            companyKeypair.publicKey,
            false,
            TOKEN_2022_PROGRAM_ID
        );
        console.log("🔹 Company Token Account:", companyTokenAccount.toString());

        // Check if company token account exists
        const tokenAccountInfo = await connection.getAccountInfo(companyTokenAccount);
        if (!tokenAccountInfo) {
            throw new Error("❌ Minting not possible: Company token account does not exist");
        }

        // Derive the last mint account PDA
        const [lastMintPda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("daily-mint"),
                companyKeypair.publicKey.toBuffer()
            ],
            PROGRAM_ID
        );
        console.log("🔹 Last Mint PDA:", lastMintPda.toString());

        // Amount to mint (5000 tokens)
        const amount = 5000 * (10 ** 9); // 5000 tokens with 9 decimals

        console.log("\n⏳ Attempting daily mint to company account...");
        
        try {
            // Use the daily_mint instruction
            const tx = await program.methods
                .dailyMint(new anchor.BN(amount))
                .accounts({
                    companyAuthority: companyKeypair.publicKey,
                    peerMint: mintPda,
                    companyTokenAccount: companyTokenAccount,
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
            console.error("❌ Error during daily mint:", error);
            if (error instanceof Error) {
                console.error("Error message:", error.message);
                if (error.message.includes("AlreadyMintedToday")) {
                    console.log("ℹ️ Tokens have already been minted today. Try again tomorrow.");
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