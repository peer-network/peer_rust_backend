import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Connection, Keypair, SystemProgram, clusterApiUrl } from "@solana/web3.js";
import { 
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddressSync,
    getAccount
} from "@solana/spl-token";
import * as fs from 'fs';
import * as path from 'path';

// Set up the program ID
const PROGRAM_ID = new PublicKey("DAApXWPZsSdDUPRhmSgQTuwKqT8ooR9oboGz9wLK69n9");

interface GemData {
    data: {
        GetGemsForDay: {
            status: string;
            ResponseCode: string;
            Date: string;
            affectedRows: {
                data: Array<{
                    userId?: string;
                    walletAddress?: string;
                    gems?: string;
                    totalGems?: string;
                }>;
            };
        };
    };
}

async function main() {
    try {
        console.log("\n🚀 Starting user token account processing...");
        
        // Set up connection
        const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
        
        // Load company wallet keypair (to pay for the account creation)
        const companyKeypairPath = "/Users/macbookpro/Solana/keys/wallet.json";
        const companyKeypair = Keypair.fromSecretKey(
            Buffer.from(JSON.parse(fs.readFileSync(companyKeypairPath, "utf-8")))
        );
        console.log("\n💼 Company wallet (fee payer):", companyKeypair.publicKey.toString());

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

        // Load Gemdata.json
        const gemDataPath = path.join(process.cwd(), "app", "ata-validator", "data", "Gemdata.json");
        console.log("\n🔍 Looking for Gemdata.json at:", gemDataPath);
        
        if (!fs.existsSync(gemDataPath)) {
            throw new Error(`❌ Gemdata.json not found at: ${gemDataPath}\nPlease ensure the file exists at this location.`);
        }

        let gemData: GemData;
        try {
            const fileContent = fs.readFileSync(gemDataPath, 'utf8');
            gemData = JSON.parse(fileContent);
            
            if (!gemData.data?.GetGemsForDay?.affectedRows?.data) {
                throw new Error("❌ Invalid Gemdata.json format: missing required data structure");
            }
            
            const users = gemData.data.GetGemsForDay.affectedRows.data.filter(user => user.userId && user.walletAddress);
            console.log(`\n📊 Found ${users.length} users in Gemdata.json`);
            
            // Process each user
            for (const user of users) {
                if (!user.userId || !user.walletAddress) continue;
                
                console.log("\n====================================");
                console.log(`👤 Processing User ID: ${user.userId}`);
                console.log(`🔑 Wallet Address: ${user.walletAddress}`);
                console.log(`💎 Gems: ${user.gems || '0'}`);
                
                const userWallet = new PublicKey(user.walletAddress);
                
                // Calculate the user ATA address
                const userAta = getAssociatedTokenAddressSync(
                    mintPda,
                    userWallet,
                    false,
                    TOKEN_2022_PROGRAM_ID
                );
                console.log("🔹 User Token Account Address:", userAta.toString());
                
                // Check if user token account exists
                const userAtaInfo = await connection.getAccountInfo(userAta);
                
                if (userAtaInfo) {
                    console.log("✅ User token account exists!");
                    console.log("🔹 Account Size:", userAtaInfo.data.length);
                    console.log("🔹 Owner Program:", userAtaInfo.owner.toString());
                    
                    // Get token balance
                    try {
                        const tokenAccount = await getAccount(connection, userAta);
                        console.log(`💰 Token Balance: ${tokenAccount.amount}`);
                    } catch (error) {
                        console.log("❌ Could not fetch token balance");
                    }
                } else {
                    console.log("⏳ Creating user token account...");
                    
                    try {
                        // Create the user token account
                        const userAtaTx = await program.methods
                            .createUserTokenAccount()
                            .accounts({
                                peerAuthority: companyKeypair.publicKey,
                                userWallet: userWallet,
                                peerMint: mintPda,
                                userTokenAccount: userAta,
                                systemProgram: SystemProgram.programId,
                                tokenProgram: TOKEN_2022_PROGRAM_ID,
                                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
                            })
                            .signers([companyKeypair])
                            .rpc();
                            
                        console.log("✅ User token account created successfully");
                        console.log("🔹 Transaction:", userAtaTx);
                        console.log("🔹 Explorer URL:", `https://explorer.solana.com/tx/${userAtaTx}?cluster=devnet`);
                        
                        // Verify creation
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
                }
            }
        } catch (error) {
            if (error instanceof SyntaxError) {
                throw new Error(`❌ Invalid JSON format in Gemdata.json: ${error.message}`);
            }
            throw error;
        }

        console.log("\n📝 IMPORTANT NOTES:");
        console.log("1. Each user can have only one token account per mint");
        console.log("2. The account address is derived from mint and user wallet");
        console.log("3. The account is automatically linked to the mint");
        console.log("4. Company pays for creation but user owns the account");
    } catch (error) {
        console.error("\n❌ ERROR:", error);
        if (error instanceof Error) {
            console.error("Error message:", error.message);
            console.error("Error stack:", error.stack);
        }
    }
}

main().then(() => console.log("\n✨ Done")); 