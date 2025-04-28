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
        console.log("\n🚀 Starting user token account creation...");
        
        // Set up connection
        const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
        
        // Load company wallet keypair (to pay for the account creation)
        const companyKeypairPath = "/Users/macbookpro/Solana/keys/wallet.json";
        const companyKeypair = Keypair.fromSecretKey(
            Buffer.from(JSON.parse(fs.readFileSync(companyKeypairPath, "utf-8")))
        );
        console.log("\n💼 Company wallet (fee payer):", companyKeypair.publicKey.toString());

        // Generate a random user wallet (for testing)
        const userWallet = Keypair.generate();
        console.log("👤 User wallet (account owner):", userWallet.publicKey.toString());

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
        console.log("🔄 Checking Mint and Creating User Token Account");
        console.log("====================================");
        
        // Derive the token mint PDA
        const [mintPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("peer-token")],
            PROGRAM_ID
        );
        console.log("🔹 Mint PDA:", mintPda.toString());

        // Check if mint exists
        console.log("\n🔍 Checking if mint account exists...");
        const mintAccountInfo = await connection.getAccountInfo(mintPda);
        
        if (!mintAccountInfo) {
            console.log("❌ Mint account does not exist!");
            console.log("Please run token.ts first to create the mint account.");
            return;
        }

        console.log("✅ Mint account exists!");
        console.log("🔹 Mint Account Size:", mintAccountInfo.data.length);
        console.log("🔹 Mint Account Owner:", mintAccountInfo.owner.toString());

        // Calculate the user ATA address
        const userAta = getAssociatedTokenAddressSync(
            mintPda,
            userWallet.publicKey,
            false,
            TOKEN_2022_PROGRAM_ID
        );
        console.log("\n🔍 Checking if user token account exists...");
        console.log("🔹 User Token Account Address:", userAta.toString());
        
        // Check if user token account exists
        const userAtaInfo = await connection.getAccountInfo(userAta);
        
        if (userAtaInfo) {
            console.log("✅ User token account already exists!");
            console.log("🔹 Account Size:", userAtaInfo.data.length);
            console.log("🔹 Owner Program:", userAtaInfo.owner.toString());
            console.log("\n📝 Note: Only one user token account can exist per user per mint.");
            return;
        }

        console.log("⏳ Creating user token account...");
        
        try {
            // Create the user token account using the user_token_account.rs instruction
            const userAtaTx = await program.methods
                .createUserTokenAccount()
                .accounts({
                    companyAuthority: companyKeypair.publicKey,
                    userWallet: userWallet.publicKey,
                    peerMint: mintPda,
                    userTokenAccount: userAta,
                    systemProgram: SystemProgram.programId,
                    tokenProgram: TOKEN_2022_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
                })
                .signers([companyKeypair])  // Company signs to pay
                .rpc();
                
            console.log("✅ User token account created successfully");
            console.log("🔹 Transaction:", userAtaTx);
            console.log("🔹 Explorer URL:", `https://explorer.solana.com/tx/${userAtaTx}?cluster=devnet`);
            
            // Verify creation
            console.log("\n🔍 Verifying user token account creation...");
            const verifyAtaInfo = await connection.getAccountInfo(userAta);
            if (verifyAtaInfo) {
                console.log("✅ User token account verified!");
                console.log("🔹 Account Size:", verifyAtaInfo.data.length);
                console.log("🔹 Owner Program:", verifyAtaInfo.owner.toString());
            }
        } catch (error) {
            console.error("❌ Error creating user token account:", error);
            if (error instanceof Error) console.error(error.message);
        }

        console.log("\n📝 IMPORTANT NOTES:");
        console.log("1. User token account is created using Associated Token Account (ATA)");
        console.log("2. Only one user token account can exist per user per mint");
        console.log("3. The account address is derived from mint and user wallet");
        console.log("4. The account is automatically linked to the mint");
        console.log("5. No PDAs are used - this is a standard Solana ATA");
        console.log("6. Company pays for creation but user owns the account");
    } catch (error) {
        console.error("\n❌ ERROR:", error);
        if (error instanceof Error) {
            console.error("Error message:", error.message);
            console.error("Error stack:", error.stack);
        }
    }
}

main().then(() => console.log("\n✨ Done")); 