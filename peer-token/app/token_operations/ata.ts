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
        console.log("\n🚀 Starting token account creation test...");
        
        // Set up connection
        const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
        
        // Load company wallet keypair
        const companyKeypairPath = "/Users/macbookpro/Solana/keys/wallet.json";
        const companyKeypair = Keypair.fromSecretKey(
            Buffer.from(JSON.parse(fs.readFileSync(companyKeypairPath, "utf-8")))
        );
        console.log("\n💼 Company wallet:", companyKeypair.publicKey.toString());

        // Create a mock user wallet
        const userKeypair = Keypair.generate();
        console.log("\n👤 User wallet:", userKeypair.publicKey.toString());

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
        console.log("🔄 Creating Token Accounts");
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

        // 1. Create company token account (PDA-based)
        const [companyTokenAccountPda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("token-2022-token-account"),
                companyKeypair.publicKey.toBuffer(),
                mintPda.toBuffer()
            ],
            PROGRAM_ID
        );
        console.log("\n📋 STEP 1: Creating Company Token Account (PDA)");
        console.log("🔹 Company Token Account PDA:", companyTokenAccountPda.toString());

        // Check if company token account exists
        const companyTokenAccountInfo = await connection.getAccountInfo(companyTokenAccountPda);
        
        if (companyTokenAccountInfo) {
            console.log("✅ Company token account already exists! Skipping creation.");
        } else {
            console.log("⏳ Creating company token account...");
            
            try {
                // Create the token account using Anchor
                const companyTokenAccountTx = await program.methods
                    .createTokenAccount()
                    .accounts({
                        signer: companyKeypair.publicKey,
                        mint: mintPda,
                        tokenAccount: companyTokenAccountPda,
                        systemProgram: SystemProgram.programId,
                        tokenProgram: TOKEN_2022_PROGRAM_ID
                    })
                    .rpc();
                    
                console.log("✅ Company token account created successfully");
                console.log("🔹 Transaction:", companyTokenAccountTx);
                console.log("🔹 Explorer URL:", `https://explorer.solana.com/tx/${companyTokenAccountTx}?cluster=devnet`);
            } catch (error) {
                console.error("❌ Error creating company token account:", error);
                if (error instanceof Error) console.error(error.message);
            }
        }

        // 2. Create company ATA
        console.log("\n📋 STEP 2: Creating Company Associated Token Account (ATA)");
        
        // Calculate the company ATA address
        const companyAta = getAssociatedTokenAddressSync(
            mintPda,
            companyKeypair.publicKey,
            false,
            TOKEN_2022_PROGRAM_ID
        );
        console.log("🔹 Company ATA:", companyAta.toString());
        
        // Check if company ATA exists
        const companyAtaInfo = await connection.getAccountInfo(companyAta);
        
        if (companyAtaInfo) {
            console.log("✅ Company ATA already exists! Skipping creation.");
        } else {
            console.log("⏳ Creating company ATA...");
            
            try {
                // Create the associated token account using Anchor
                const companyAtaTx = await program.methods
                    .createAssociatedTokenAccount()
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
            } catch (error) {
                console.error("❌ Error creating company ATA:", error);
                if (error instanceof Error) console.error(error.message);
            }
        }

        // 3. Create user token account with company paying the fee
        console.log("\n📋 STEP 3: Creating User Token Account (Company pays fee)");
        
        // Derive a PDA for the user token account
        const [userTokenAccountPda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("user-token-account"),
                userKeypair.publicKey.toBuffer(),
                mintPda.toBuffer()
            ],
            PROGRAM_ID
        );
        
        console.log("🔹 User Token Account PDA:", userTokenAccountPda.toString());
        
        // Check if user token account exists
        const userTokenAccountInfo = await connection.getAccountInfo(userTokenAccountPda);
        
        if (userTokenAccountInfo) {
            console.log("✅ User token account already exists! Skipping creation.");
        } else {
            console.log("⏳ Creating user token account with company as fee payer...");
            
            try {
                // Create user token account where company pays but user is the owner
                const userTokenAccountTx = await program.methods
                    .createUserTokenAccount()
                    .accounts({
                        companyAuthority: companyKeypair.publicKey,
                        userWallet: userKeypair.publicKey,
                        peerMint: mintPda,
                        userTokenAccount: userTokenAccountPda,
                        systemProgram: SystemProgram.programId,
                        tokenProgram: TOKEN_2022_PROGRAM_ID,
                        rent: anchor.web3.SYSVAR_RENT_PUBKEY
                    })
                    .rpc();
                    
                console.log("✅ User token account created successfully");
                console.log("🔹 Transaction:", userTokenAccountTx);
                console.log("🔹 Explorer URL:", `https://explorer.solana.com/tx/${userTokenAccountTx}?cluster=devnet`);
            } catch (error) {
                console.error("❌ Error creating user token account:", error);
                if (error instanceof Error) console.error(error.message);
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