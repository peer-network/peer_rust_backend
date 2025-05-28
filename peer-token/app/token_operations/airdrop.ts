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
import { getIdl, getKeypairFromEnvPath, getPublicKey, getSolanaConnection } from "../../utils";
import { ErrorHandler, ErrorFactory, ErrorCode, Validators } from "../errors";

// Set up the program ID
const program_id = getPublicKey("PROGRAM_ID");
const connection = getSolanaConnection();
const companyWallet = getKeypairFromEnvPath("COMPANY_WALLET_PATH");
const idl = getIdl();

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
        let mintInfo;
        try {
            mintInfo = await getMint(
                connection,
                mintPda,
                'confirmed',
                TOKEN_2022_PROGRAM_ID
            );
        } catch (error) {
            throw ErrorFactory.mintNotFound(mintPda);
        }
        
        const decimals = mintInfo.decimals;
        console.log(`🔹 Token Decimals: ${decimals}`);

        // Function to format token amounts
        const formatAmount = (amount: number | bigint) => {
            return (Number(amount) / Math.pow(10, decimals)).toFixed(decimals);
        };

        // Check initial company balance
        const initialCompanyInfo = await connection.getAccountInfo(companyTokenAccount);
        if (!initialCompanyInfo) {
            throw ErrorFactory.tokenAccountNotFound(companyTokenAccount, companyWallet.publicKey);
        }
        
        const initialAccount = unpackAccount(companyTokenAccount, initialCompanyInfo, TOKEN_2022_PROGRAM_ID);
        console.log(`💰 Initial company token balance: ${formatAmount(initialAccount.amount)} tokens`);

        // let tokenData = tokendata;
        if (!tokendata?.data?.GetGemsForDay?.affectedRows?.data) {
            throw ErrorFactory.transactionFailed("data validation", new Error("Invalid data structure: missing data.GetGemsForDay.affectedRows.data array"));
        }

        console.log(`\n📊 Total distributions to process: ${tokendata.data.GetGemsForDay.affectedRows.data.length}`);

        let successfulTransfers = 0;
        let failedTransfers = 0;
        let totalTokensDistributed = 0;

        // Process each distribution
        for (const distribution of tokendata.data.GetGemsForDay.affectedRows.data) {
            console.log("\n====================================");
            console.log(`👤 Processing User ID: ${distribution.userId}`);
            console.log(`🔑 Wallet: ${distribution.walletAddress}`);
            console.log(`💰 Tokens to send: ${distribution.tokens}`);

            try {
                // Validate required fields
                if (!distribution.userId || !distribution.walletAddress || !distribution.tokens) {
                    throw ErrorFactory.transactionFailed("validation", new Error("Missing required field: userId, walletAddress or tokens"));
                }
                
                // Validate wallet address
                let userWallet: PublicKey;
                try {
                    userWallet = Validators.publicKey(distribution.walletAddress, "user wallet address");
                } catch (error) {
                    throw ErrorFactory.transactionFailed("validation", new Error(`Invalid wallet address format for user ${distribution.userId}`));
                }
                
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
                    throw ErrorFactory.tokenAccountNotFound(userTokenAccount, userWallet);
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
                
                successfulTransfers++;
                totalTokensDistributed += distribution.tokens;

            } catch (error) {
                console.error(`❌ Error processing transfer for user ${distribution.userId}:`);
                ErrorHandler.handle(error);
                failedTransfers++;
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
        console.log(`✅ Successful transfers: ${successfulTransfers}`);
        console.log(`❌ Failed transfers: ${failedTransfers}`);
        console.log(`💰 Total tokens distributed: ${totalTokensDistributed}`);

    } catch (error) {
        console.error("\n❌ ERROR DURING AIRDROP:");
        const errorDetails = ErrorHandler.handle(error);
        console.error(`Error code: ${errorDetails.code}, Message: ${errorDetails.message}`);
        
        if (errorDetails.details) {
            console.error("Error details:", JSON.stringify(errorDetails.details, null, 2));
        }
        
        throw error; // Re-throw so calling code can handle it
    }
}
// main(tokenDistribution).then(() => console.log("\n✨ Airdrop process completed")); 