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
import * as dotenv from 'dotenv';
import { tokenDistribution } from "../mockdata/distribution";
import { getIdl, getKeypairFromEnvPath, getPublicKey, getSolanaConnection } from "../../utilss";
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Set up the program ID
const program_id = getPublicKey("PROGRAM_ID");
const connection = getSolanaConnection();
const companyWallet = getKeypairFromEnvPath("COMPANY_WALLET_PATH");
const idl = getIdl();  

export interface TokenDistribution  {
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


export async function main() {
    try {
        console.log("\n🚀 Starting user token account processing...");
        
        
        console.log("\n💼 Company wallet (fee payer):", companyWallet.publicKey.toString());

        // Create provider with company wallet
        const provider = new anchor.AnchorProvider(
            connection,
            new anchor.Wallet(companyWallet),
            { commitment: "confirmed" }
        );
        anchor.setProvider(provider);

       
        // Create program interface
        const program = new anchor.Program(idl, program_id, provider);

        // Derive the token mint PDA
        const [mintPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("peer-token")],
            program_id
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

     
         
        try {
            
            if (!tokenDistribution.data?.GetGemsForDay?.affectedRows?.data) {
                throw new Error("❌ Invalid token distribution format: missing required data structure");
            }
            
            // const users = tokenDistribution.data.GetGemsForDay.affectedRows.data.filter(user => user.userId && user.walletAddress);
            const users = tokenDistribution.data.GetGemsForDay.affectedRows.data;
            console.log(`\n📊 Found ${users.length} users in token distribution`);
            
            // Process each user
            for (const user of users) {
                if (!user.userId || !user.walletAddress) continue;
                
                console.log("\n====================================");
                console.log(`👤 Processing User ID: ${user.userId}`);
                console.log(`🔑 Wallet Address: ${user.walletAddress}`);
                console.log(`💎 Tokens: ${user.tokens || '0'}`);
                
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
                    
                    
                    // // Get token balance
                    // try {
                    //     const tokenAccount = await getAccount(connection, userAta);
                    //     console.log(`💰 Token Balance: ${tokenAccount.amount}`);
                    // } catch (error) {
                    //     console.log("❌ Could not fetch token balance");
                    //     console.log(error);
                    // }

                    try {
                        const tokenAccount = await getAccount(connection, userAta, undefined, TOKEN_2022_PROGRAM_ID);
                        console.log(`💰 Token Balance: ${tokenAccount.amount}`);
                    } catch (error) {
                        console.log("❌ Could not fetch token balance");
                        console.log(error);
                    }
                } else {
                    console.log("⏳ Creating user token account...");
                    
                    try {
                        // Create the user token account
                        const userAtaTx = await program.methods
                            .createUserTokenAccount()
                            .accounts({
                                peerAuthority: companyWallet.publicKey,
                                userWallet: userWallet,
                                peerMint: mintPda,
                                userTokenAccount: userAta,
                                systemProgram: SystemProgram.programId,
                                tokenProgram: TOKEN_2022_PROGRAM_ID,
                                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
                            })
                            .signers([companyWallet])
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