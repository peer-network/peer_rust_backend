import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Connection, Keypair, SystemProgram, clusterApiUrl } from "@solana/web3.js";
import { 
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddressSync,
    getAccount,
    unpackAccount,
    getMint
} from "@solana/spl-token";
import * as fs from 'fs';
import * as path from 'path';
import { BN } from "bn.js";
import * as dotenv from 'dotenv';
import { TokenDistribution } from "../mockdata/distribution";
import { getIdl, getKeypairFromEnvPath, getPublicKey, getSolanaConnection } from "../../utilss";



// Set up the program ID
const program_id = getPublicKey("PROGRAM_ID");
const connection = getSolanaConnection();
const companyWallet = getKeypairFromEnvPath("COMPANY_WALLET_PATH");
const idl = getIdl();

// export interface TokenDistribution  {
//     data: {
//         GetGemsForDay: {
//             status: string;
//             ResponseCode: string;
//             Date: string;
//             affectedRows: {
//                 data: Array<{
//                     userId?: string;
//                     walletAddress?: string;
//                     tokens?: string;
//                 }>;
//                 totalTokens?: string;
//             };
//         };
//     };
// }
export async function main(tokendata: TokenDistribution) {
    try {
        console.log("\n🚀 Starting token airdrop process...");
        
        
        console.log("\n💼 Company wallet (token sender):", companyWallet.publicKey.toString());

        // Create provider
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

        // Get company token account
        const companyTokenAccount = getAssociatedTokenAddressSync(
            mintPda,
            companyWallet.publicKey,
            false,
            TOKEN_2022_PROGRAM_ID
        );
        console.log("🔹 Company Token Account:", companyTokenAccount.toString());

        // Get mint info to get decimals
        const mintInfo = await getMint(
            connection,
            mintPda,
            'confirmed',
            TOKEN_2022_PROGRAM_ID
        );
        const decimals = mintInfo.decimals;
        console.log(`🔹 Token Decimals: ${decimals}`);

        // Function to format token amounts
        const formatAmount = (amount: number | bigint) => {
            return (Number(amount) / Math.pow(10, decimals)).toFixed(decimals);
        };

        // Check initial company balance
        const initialCompanyInfo = await connection.getAccountInfo(companyTokenAccount);
        if (initialCompanyInfo) {
            const initialAccount = unpackAccount(companyTokenAccount, initialCompanyInfo, TOKEN_2022_PROGRAM_ID);
            console.log(`💰 Initial company token balance: ${formatAmount(initialAccount.amount)} tokens`);
        }

        

        // let tokenData = tokendata;

        console.log(`\n📊 Total distributions to process: ${tokendata.data.GetGemsForDay.affectedRows.data.length}`);

        // Process each distribution
        for (const distribution of tokendata.data.GetGemsForDay.affectedRows.data) {
            console.log("\n====================================");
            console.log(`👤 Processing User ID: ${distribution.userId}`);
            console.log(`🔑 Wallet: ${distribution.walletAddress}`);
            console.log(`💰 Tokens to send: ${distribution.tokens}`);

            try {
                const userWallet = new PublicKey(distribution.walletAddress);
                
                // Convert token amount to proper decimal representation
                const transferAmount = distribution.tokens * (10 ** 9); // 9 decimals like in mint_to_company
                console.log(`💰 Tokens to send: ${distribution.tokens}`);

                // Get user's token account address
                const userTokenAccount = getAssociatedTokenAddressSync(
                    mintPda,
                    userWallet,
                    false,
                    TOKEN_2022_PROGRAM_ID
                );
                console.log("🔹 User Token Account:", userTokenAccount.toString());

                // Check if user token account exists
                const userTokenAccountInfo = await connection.getAccountInfo(userTokenAccount);
                if (!userTokenAccountInfo) {
                    throw new Error("❌ User token account does not exist");
                }
                

                // Execute transfer with proper decimal amount
                const tx = await program.methods
                    .transferTokens(new BN(transferAmount))
                    .accounts({
                        peerAuthority: companyWallet.publicKey,
                        userWallet: userWallet,
                        peerMint: mintPda,
                        peerTokenAccount: companyTokenAccount,
                        userTokenAccount: userTokenAccount,
                        tokenProgram: TOKEN_2022_PROGRAM_ID,
                        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                        systemProgram: SystemProgram.programId,
                    })
                    .signers([companyWallet])
                    .rpc();

                console.log("✅ Transfer successful!");
                console.log("🔹 Transaction:", tx);
                console.log("🔹 Explorer URL:", `https://explorer.solana.com/tx/${tx}?cluster=devnet`);

                // Wait for confirmation
                await connection.confirmTransaction(tx);
                const accountInfo = await connection.getAccountInfo(userTokenAccount);
                if (accountInfo) {
                    const account = unpackAccount(userTokenAccount, accountInfo, TOKEN_2022_PROGRAM_ID);
                    console.log(`💰 New token balance: ${formatAmount(account.amount)} tokens`);
                }

            } catch (error) {
                console.error(`❌ Error processing transfer for user ${distribution.userId}:`, error);
                if (error instanceof Error) console.error(error.message);
                // Continue with next distribution
            }
        }

        // Check final company balance
        const finalCompanyInfo = await connection.getAccountInfo(companyTokenAccount);
        if (finalCompanyInfo) {
            const finalAccount = unpackAccount(companyTokenAccount, finalCompanyInfo, TOKEN_2022_PROGRAM_ID);
            console.log(`\n💰 Final company token balance: ${formatAmount(finalAccount.amount)} tokens`);
        }

        console.log("\n📝 SUMMARY:");
        console.log(`Total distributions attempted: ${tokendata.data.GetGemsForDay.affectedRows.data.length}`);
        console.log(`Total tokens distributed: ${tokendata.data.GetGemsForDay.affectedRows.totalTokens}`);

    } catch (error) {
        console.error("\n❌ ERROR:", error);
        if (error instanceof Error) {
            console.error("Error message:", error.message);
            console.error("Error stack:", error.stack);
        }
    }
}

// main(tokenDistribution).then(() => console.log("\n✨ Airdrop process completed")); 