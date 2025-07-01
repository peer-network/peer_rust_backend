import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Connection, Keypair, SystemProgram, clusterApiUrl, ConfirmedSignatureInfo } from "@solana/web3.js";
import { 
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddressSync
} from "@solana/spl-token";
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { getPublicKey, getSolanaConnection, getKeypairFromEnvPath, getIdl } from "../../utils";
import { ErrorHandler, ErrorFactory, ErrorCode } from "../errors";

// Define local interfaces instead of importing from external module
export enum Status {
    success = "SUCCESS",
    error = "ERROR"
}

export interface MintResponse {
    code: string;
    message: string;
    status: Status;
    data: any;
}

class MintResponseImpl implements MintResponse {
    constructor(
        public code: string,
        public message: string,
        public status: Status,
        public data: any,
    ) {}

    static success(data: any = []): MintResponseImpl {
        return new MintResponseImpl(
            "200",
            "Operation completed successfully",
            Status.success,
            data
        )
    }

    static error(code: string, message: string, details: any = null): MintResponseImpl {
        return new MintResponseImpl(
            code,
            message,
            Status.error,
            details ? details : []
        )
    }
}

// Set up the program ID
const program_id = getPublicKey("PROGRAM_ID");
const connection = getSolanaConnection();
const companyWallet = getKeypairFromEnvPath("ADMIN_WALLET_PATH");
const idl = getIdl();

// Constants
const DAILY_MINT_AMOUNT = 5000; // 5000 tokens
const TOKEN_DECIMALS = 9;
const DAILY_MINT_RAW_AMOUNT = DAILY_MINT_AMOUNT * (10 ** TOKEN_DECIMALS); // 5000000000000

/**
 * Check if daily_mint instruction was already executed today by examining transaction history
 */
async function checkIfAlreadyMintedToday(): Promise<boolean> {
    try {
        console.log("🔍 Checking transaction history for today's minting...");
        
        // Skip check if SKIP_DAILY_CHECK environment variable is set (for testing)
        if (process.env.SKIP_DAILY_CHECK === 'true') {
            console.log("⚠️ Daily check skipped (SKIP_DAILY_CHECK=true)");
            return false;
        }
        
        // Get current date boundaries (start and end of today in UTC)
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);
        
        console.log("🔹 Checking period:", startOfToday.toISOString(), "to", endOfToday.toISOString());
        
        // Get recent transaction signatures for the company wallet (reduced limit to avoid rate limiting)
        const signatures = await connection.getSignaturesForAddress(
            companyWallet.publicKey,
            {
                limit: 20 // Reduced from 100 to 20 to avoid rate limits
            }
        );
        
        console.log(`🔹 Found ${signatures.length} recent transactions`);
        
        // Filter signatures from today
        const todaySignatures = signatures.filter((sig: ConfirmedSignatureInfo) => {
            if (!sig.blockTime) return false;
            const txDate = new Date(sig.blockTime * 1000);
            return txDate >= startOfToday && txDate <= endOfToday;
        });
        
        console.log(`🔹 Found ${todaySignatures.length} transactions from today`);
        
        if (todaySignatures.length === 0) {
            console.log("✅ No transactions found today - safe to mint");
            return false;
        }
        
        // Limit the number of transactions to check to avoid rate limiting
        const maxTransactionsToCheck = Math.min(todaySignatures.length, 10);
        console.log(`🔹 Checking ${maxTransactionsToCheck} most recent transactions from today`);
        
        // Check each transaction from today to see if it contains daily_mint instruction
        for (let i = 0; i < maxTransactionsToCheck; i++) {
            const sigInfo = todaySignatures[i];
            try {
                // Add delay between requests to avoid rate limiting
                if (i > 0) {
                    await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
                }
                
                const transaction = await connection.getTransaction(sigInfo.signature, {
                    maxSupportedTransactionVersion: 0
                });
                
                if (!transaction || !transaction.meta || transaction.meta.err) {
                    continue; // Skip failed or invalid transactions
                }
                
                // Check if this transaction involved our program
                const accountKeys = transaction.transaction.message.getAccountKeys();
                const programInvolved = accountKeys.staticAccountKeys.some(key => 
                    key.equals(program_id)
                );
                
                if (programInvolved) {
                    // Check transaction logs for daily_mint instruction with specific amount validation
                    const logs = transaction.meta.logMessages || [];
                    
                    // Daily mint amount validation
                    const dailyMintAmountStr = DAILY_MINT_RAW_AMOUNT.toString();
                    const dailyMintUIAmount = DAILY_MINT_AMOUNT.toString(); // UI amount
                    
                    // Check for daily mint instruction patterns
                    const isDailyMintInstruction = logs.some(log => 
                        log.includes('Daily minted') || 
                        log.includes('daily_mint') ||
                        log.includes('Instruction: DailyMint')
                    );
                    
                    // Check for specific daily mint amount in logs
                    const hasCorrectAmount = logs.some(log => 
                        log.includes(dailyMintAmountStr) || // Raw amount: 5000000000000
                        log.includes(dailyMintUIAmount) ||  // UI amount: 5000
                        log.includes('5000 tokens') ||     // Formatted amount
                        (log.includes('mint') && log.includes('5000')) // Generic mint with 5000
                    );
                    
                    // Must have both daily mint instruction AND correct amount
                    const isDailyMint = isDailyMintInstruction && hasCorrectAmount;
                    
                    if (isDailyMint) {
                        const txDate = new Date(sigInfo.blockTime! * 1000);
                        console.log("❌ Found daily_mint transaction from today:");
                        console.log("🔹 Transaction:", sigInfo.signature);
                        console.log("🔹 Time:", txDate.toISOString());
                        console.log("🔹 Amount validated: 5000 tokens");
                        return true;
                    }
                    
                    // Log if we found instruction but wrong amount (for debugging)
                    if (isDailyMintInstruction && !hasCorrectAmount) {
                        console.log("🔹 Found daily_mint instruction but amount doesn't match 5000 tokens");
                    }
                }
            } catch (error) {
                // Handle rate limiting specifically
                if (error instanceof Error && error.message.includes('429')) {
                    console.warn("⚠️ Rate limited - unable to complete full transaction history check");
                    console.log("⚠️ Proceeding with mint (err on side of allowing mint)");
                    return false;
                }
                console.warn(`⚠️ Could not parse transaction ${sigInfo.signature}:`, error);
                // Continue checking other transactions
            }
        }
        
        console.log("✅ No daily_mint transactions found in checked transactions - safe to mint");
        return false;
        
    } catch (error) {
        console.warn("⚠️ Error checking transaction history:", error);
        // If we can't check history, err on the side of caution and allow minting
        // The worst case is duplicate minting, which is better than blocking legitimate mints
        console.log("⚠️ Unable to verify transaction history - proceeding with mint");
        return false;
    }
}

export async function mint(): Promise<MintResponseImpl> {
    try {
        console.log("\n🚀 Starting daily token minting to company account...");
        
        console.log("\n💼 Company wallet:", companyWallet.publicKey.toString());

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
        const mintAccountInfo = await connection.getAccountInfo(mintPda);
        if (!mintAccountInfo) {
            const error = ErrorFactory.mintNotFound(mintPda);
            return MintResponseImpl.error(
                error.code.toString(),
                error.message,
                error.details
            );
        }
        else {
            console.log("✅ Mint account exists!");
            console.log("🔹 Mint Account Size:", mintAccountInfo.data.length);
            console.log("🔹 Mint Account Owner:", mintAccountInfo.owner.toString());
            console.log("-------------------------------------");
        }
        
        // Get company's token account address
        const companyTokenAccount = getAssociatedTokenAddressSync(
            mintPda,
            companyWallet.publicKey,
            false,
            TOKEN_2022_PROGRAM_ID
        );
        console.log("🔹 Company Token Account:", companyTokenAccount.toString());

        // Check if company token account exists
        const tokenAccountInfo = await connection.getAccountInfo(companyTokenAccount);
        if (!tokenAccountInfo) {
            const error = ErrorFactory.tokenAccountNotFound(companyTokenAccount, companyWallet.publicKey);
            return MintResponseImpl.error(
                error.code.toString(),
                error.message,
                error.details
            );
        }
        else {
            console.log("✅ Company token account exists!");
            console.log("🔹 Company Token Account Size:", tokenAccountInfo.data.length);
            console.log("🔹 Company Token Account Owner:", tokenAccountInfo.owner.toString());
        }

        console.log("-------------------------------------");

        // CLIENT-SIDE DAILY MINT CHECK - Check transaction history
        const alreadyMinted = await checkIfAlreadyMintedToday();
        if (alreadyMinted) {
            console.log("ℹ️ Tokens have already been minted today. Try again tomorrow.");
            const error = ErrorFactory.alreadyMintedToday();
            return MintResponseImpl.error(
                error.code.toString(),
                error.message,
                {
                    checkMethod: "transaction_history",
                    currentDate: new Date().toISOString()
                }
            );
        }

        // Amount to mint (5000 tokens)
        const amount = DAILY_MINT_RAW_AMOUNT;

        console.log("\n⏳ Attempting daily mint to company account...");
        
        try {
            // Use the simplified daily_mint instruction (no LastMint PDA needed)
            const tx = await program.methods
                .dailyMint(new anchor.BN(amount))
                .accounts({
                    peerAuthority: companyWallet.publicKey,
                    peerMint: mintPda,
                    peerTokenAccount: companyTokenAccount,
                    tokenProgram: TOKEN_2022_PROGRAM_ID,
                    systemProgram: SystemProgram.programId
                })
                .signers([companyWallet])
                .rpc();
                
            console.log("✅ Daily mint successful");
            console.log("🔹 Transaction:", tx);
            console.log("🔹 Explorer URL:", `https://explorer.solana.com/tx/${tx}?cluster=devnet`);
            
            // Verify the mint
            const tokenAccountInfo = await connection.getTokenAccountBalance(companyTokenAccount);
            console.log("\n💰 Company Token Balance:", tokenAccountInfo.value.uiAmount);
            return MintResponseImpl.success({
                tx: tx,
                balance: tokenAccountInfo.value.uiAmount
            });
        } catch (error) {
            const errorResponse = ErrorHandler.handle(error);
            
            return MintResponseImpl.error(
                errorResponse.code.toString(),
                errorResponse.message,
                errorResponse.details
            );
        }
    } catch (e) {
        console.error("\n❌ ERROR:");
        const errorResponse = ErrorHandler.handle(e);
        
        return MintResponseImpl.error(
            errorResponse.code.toString(),
            errorResponse.message,
            errorResponse.details
        );
    }
}

mint();