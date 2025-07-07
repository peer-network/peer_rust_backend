import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Connection, Keypair, SystemProgram } from "@solana/web3.js";
import {
    TOKEN_2022_PROGRAM_ID,
    getAssociatedTokenAddressSync,
    getAccount
} from "@solana/spl-token";
import * as fs from 'fs';
import * as path from 'path';
import { BN } from "bn.js";
import { tokenDistribution } from "../mockdata/distribution";
import { getIdl, getKeypairFromEnvPath, getPublicKey, getSolanaConnection, getTokenDecimals } from "../../utils";
import { ErrorHandler, ErrorFactory, ErrorCode, Validators } from "../errors";

// Set up the program ID and connection
const program_id = getPublicKey("PROGRAM_ID");
const connection = getSolanaConnection();
const senderWallet = getKeypairFromEnvPath("SENDER_WALLET_PATH");
const idl = getIdl();
const token_decimals = getTokenDecimals("TOKEN_DECIMALS");

export async function main() {
    try {
        console.log("\n🚀 Starting useraction (peer-to-peer transfer) processing...");
        console.log("\n💼 Sender wallet:", senderWallet.publicKey.toString());

        // Create provider with sender wallet
        const provider = new anchor.AnchorProvider(
            connection,
            new anchor.Wallet(senderWallet),
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
        const mintAccountInfo = await connection.getAccountInfo(mintPda);
        if (!mintAccountInfo) {
            throw ErrorFactory.mintNotFound(mintPda);
        }
        console.log("✅ Mint account exists!");

        // Use mock distribution data
        const users = tokenDistribution.data.GetGemsForDay.affectedRows.data;
        console.log(`\n📊 Found ${users.length} users in token distribution`);

        let successfulTransfers = 0;
        let failedTransfers = 0;

        // Sender's token account
        const senderTokenAccount = getAssociatedTokenAddressSync(
            mintPda,
            senderWallet.publicKey,
            false,
            TOKEN_2022_PROGRAM_ID
        );
        console.log("🔹 Sender Token Account:", senderTokenAccount.toString());

        // Check sender token account exists
        const senderTokenAccountInfo = await connection.getAccountInfo(senderTokenAccount);
        if (!senderTokenAccountInfo) {
            throw ErrorFactory.tokenAccountNotFound(senderTokenAccount, senderWallet.publicKey);
        }

        for (const user of users) {
            if (!user.userId || !user.walletAddress || !user.tokens) {
                console.error(`⚠️ Skipping user with missing data: userId=${user.userId}, walletAddress=${user.walletAddress}`);
                failedTransfers++;
                continue;
            }

            try {
                const recipientWallet = Validators.publicKey(user.walletAddress, "recipient wallet address");
                const recipientTokenAccount = getAssociatedTokenAddressSync(
                    mintPda,
                    recipientWallet,
                    false,
                    TOKEN_2022_PROGRAM_ID
                );
                console.log("\n====================================");
                console.log(`👤 Processing User ID: ${user.userId}`);
                console.log(`🔑 Recipient Wallet: ${recipientWallet.toString()}`);
                console.log(`💰 Tokens to send: ${user.tokens}`);
                console.log(`🔹 Recipient Token Account: ${recipientTokenAccount.toString()}`);

                // Check recipient token account exists
                const recipientTokenAccountInfo = await connection.getAccountInfo(recipientTokenAccount);
                if (!recipientTokenAccountInfo) {
                    throw ErrorFactory.tokenAccountNotFound(recipientTokenAccount, recipientWallet);
                }

                // Convert token amount to proper decimal representation
                const transferAmount = Number(user.tokens) * (10 ** token_decimals);

                // Call user_action instruction
                const tx = await program.methods
                    .userAction(new BN(transferAmount))
                    .accounts({
                        peerMint: mintPda,
                        senderWallet: senderWallet.publicKey,
                        recipientWallet: recipientWallet,
                        senderTokenAccount: senderTokenAccount,
                        recipientTokenAccount: recipientTokenAccount,
                        tokenProgram: TOKEN_2022_PROGRAM_ID,
                        systemProgram: SystemProgram.programId
                    })
                    .signers([senderWallet])
                    .rpc();

                console.log("✅ Transfer successful!");
                console.log("🔹 Transaction:", tx);
                console.log("🔹 Explorer URL:", `https://explorer.solana.com/tx/${tx}?cluster=devnet`);
                successfulTransfers++;
            } catch (error) {
                console.error(`❌ Error processing transfer for user ${user.userId}:`);
                ErrorHandler.handle(error);
                failedTransfers++;
                continue;
            }
        }

        console.log("\n📊 USERACTION TRANSFER SUMMARY:");
        console.log(`✅ Successful: ${successfulTransfers} transfers`);
        console.log(`❌ Failed: ${failedTransfers} transfers`);
    } catch (error) {
        console.error("\n❌ ERROR DURING USERACTION PROCESSING:");
        const errorDetails = ErrorHandler.handle(error);
        console.error(`Error code: ${errorDetails.code}, Message: ${errorDetails.message}`);
        if (errorDetails.details) {
            console.error("Error details:", JSON.stringify(errorDetails.details, null, 2));
        }
        if (errorDetails.onChainCode) {
            console.error(`On-chain error code: ${errorDetails.onChainCode}`);
        }
    }
}

if (require.main === module) {
    main().then(() => console.log("\n✨ Useraction transfer process finished"));
} 