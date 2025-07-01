import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Connection, Keypair, SystemProgram, clusterApiUrl } from "@solana/web3.js";
import { 
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddressSync
} from "@solana/spl-token";
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { ErrorHandler } from "../errors";

dotenv.config();

// Set up the program ID
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID!);


async function main() {
    try {
        console.log("\n🚀 Starting company token account creation...");
        
        // Set up connection
        // const connection = new Connection(clusterApiUrl("devnet"), "confirmed");÷


        const connection = new Connection(process.env.RPC_ENDPOINT || clusterApiUrl("devnet"), "confirmed");

        
        // Load company wallet keypair
        // const companyKeypairPath = "/Users/macbookpro/Solana/keys/wallet.json";
        const keypair = Keypair.fromSecretKey(
            Buffer.from(JSON.parse(fs.readFileSync(process.env.ADMIN_WALLET_PATH!, "utf-8")))
        );
        console.log("\n💼 Company wallet:", keypair.publicKey.toString());

        // Create provider with company wallet
        const provider = new anchor.AnchorProvider(
            connection,
            new anchor.Wallet(keypair),
            { commitment: "confirmed" }
        );
        anchor.setProvider(provider);

        // Load the IDL
        // const idlPath = path.join(process.cwd(), "target", "idl", "peer_token.json");
        const idlFile = fs.readFileSync(process.env.IDL_PATH!, 'utf8');
        const idl = JSON.parse(idlFile);

        // Create program interface
        const program = new anchor.Program(idl, PROGRAM_ID, provider);

        console.log("\n====================================");
        console.log("🔄 Checking Mint and Creating Company Token Account");
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

        // Calculate the company ATA address
        const companyAta = getAssociatedTokenAddressSync(
            mintPda,
            keypair.publicKey,
            false,
            TOKEN_2022_PROGRAM_ID
        );
        console.log("\n🔍 Checking if company token account exists...");
        console.log("🔹 Company Token Account Address:", companyAta.toString());
        
        // Check if company token account exists
        const companyAtaInfo = await connection.getAccountInfo(companyAta);
        
        if (companyAtaInfo) {
            console.log("✅ Company token account already exists!");
            console.log("🔹 Account Size:", companyAtaInfo.data.length);
            console.log("🔹 Owner Program:", companyAtaInfo.owner.toString());
            console.log("\n📝 Note: Only one company token account can exist per mint.");
            return;
        }

        console.log("⏳ Creating company token account...");
        
        try {
            // Create the company token account using the associated_account.rs instruction
            const companyAtaTx = await program.methods
                .createAssociatedTokenAccount()
                .accounts({
                    signer: keypair.publicKey,
                    peerMint: mintPda,
                    peerTokenAccount: companyAta,
                    systemProgram: SystemProgram.programId,
                    tokenProgram: TOKEN_2022_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
                })
                .signers([keypair])
                .rpc();
                
            console.log("✅ Company token account created successfully");
            console.log("🔹 Transaction:", companyAtaTx);
            console.log("🔹 Explorer URL:", `https://explorer.solana.com/tx/${companyAtaTx}?cluster=devnet`);
            
            // Verify creation
            console.log("\n🔍 Verifying company token account creation...");
            const verifyAtaInfo = await connection.getAccountInfo(companyAta);
            if (verifyAtaInfo) {
                console.log("✅ Company token account verified!");
                console.log("🔹 Account Size:", verifyAtaInfo.data.length);
                console.log("🔹 Owner Program:", verifyAtaInfo.owner.toString());
            }
        } catch (error) {
            console.error("❌ Error creating company token account:");
            ErrorHandler.handle(error);
        }

        console.log("\n📝 IMPORTANT NOTES:");
        console.log("1. Company token account is created using Associated Token Account (ATA)");
        console.log("2. Only one company token account can exist per mint");
        console.log("3. The account address is derived from mint and company wallet");
        console.log("4. The account is automatically linked to the mint");
        console.log("5. No PDAs are used - this is a standard Solana ATA");
    } catch (error) {
        console.error("\n❌ ERROR:");
        ErrorHandler.handle(error);
    }
}

main().then(() => console.log("\n✨ Done")); 