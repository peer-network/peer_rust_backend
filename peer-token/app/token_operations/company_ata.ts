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
        console.log("\n🚀 Starting company ATA creation...");
        
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

        console.log("\n====================================");
        console.log("🔄 Creating Company Associated Token Account (ATA)");
        console.log("====================================");
        
        // Derive the token mint PDA
        const [mintPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("peer-token")],
            PROGRAM_ID
        );
        console.log("🔹 Using Mint PDA:", mintPda.toString());

        // Check if mint exists
        const mintAccountInfo = await connection.getAccountInfo(mintPda);
        if (!mintAccountInfo) {
            console.log("❌ Mint account does not exist. Please run token.ts first to create the mint.");
            return;
        }

        // Calculate the company ATA address using standard Solana ATA derivation
        const companyAta = getAssociatedTokenAddressSync(
            mintPda,
            companyKeypair.publicKey,
            false,
            TOKEN_2022_PROGRAM_ID
        );
        console.log("\n📋 Company Associated Token Account (ATA)");
        console.log("🔹 Company ATA address:", companyAta.toString());
        
        // Check if company ATA exists
        const companyAtaInfo = await connection.getAccountInfo(companyAta);
        
        if (companyAtaInfo) {
            console.log("✅ Company ATA already exists!");
            console.log("🔹 Account Size:", companyAtaInfo.data.length);
            console.log("🔹 Owner Program:", companyAtaInfo.owner.toString());
        } else {
            console.log("⏳ Creating company ATA...");
            
            try {
                // Create the associated token account using Anchor
                // This uses the associated_account.rs instruction
                const companyAtaTx = await program.methods
                    .createAssociatedTokenAccount() // This maps to associated_account.rs
                    .accounts({
                        peerAuthority: companyKeypair.publicKey,
                        peerMint: mintPda,
                        tokenAccount: companyAta,
                        systemProgram: SystemProgram.programId,
                        tokenProgram: TOKEN_2022_PROGRAM_ID,
                        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
                    })
                    .rpc();
                    
                console.log("✅ Company ATA created successfully");
                console.log("🔹 Transaction:", companyAtaTx);
                console.log("🔹 Explorer URL:", `https://explorer.solana.com/tx/${companyAtaTx}?cluster=devnet`);
                
                // Verify creation
                console.log("\n🔍 Verifying company ATA creation...");
                const verifyAtaInfo = await connection.getAccountInfo(companyAta);
                if (verifyAtaInfo) {
                    console.log("✅ Company ATA verified!");
                }
            } catch (error) {
                console.error("❌ Error creating company ATA:", error);
                if (error instanceof Error) console.error(error.message);
            }
        }

        console.log("\n📝 IMPORTANT NOTES on Company Token Account:");
        console.log("1. Associated Token Accounts (ATAs) are used for company token accounts");
        console.log("2. Each wallet can have only ONE ATA per token mint");
        console.log("3. The ATA address is deterministically derived from the company wallet and mint");
        console.log("4. The same ATA instruction (associated_account.rs) is used for all wallets");
        console.log("5. The ATA will be automatically linked to the mint address");
        console.log("6. No PDAs are required for ATAs - they use Solana's standard derivation");
    } catch (error) {
        console.error("\n❌ ERROR:", error);
        if (error instanceof Error) {
            console.error("Error message:", error.message);
            console.error("Error stack:", error.stack);
        }
    }
}

main().then(() => console.log("\n✨ Done")); 