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
import { ErrorHandler } from "../errors";

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
const companyWallet = getKeypairFromEnvPath("COMPANY_WALLET_PATH");
const idl = getIdl();

// Error codes
const ERROR_CODES = {
    MINT_NOT_FOUND: "MINT_001",
    TOKEN_ACCOUNT_NOT_FOUND: "TOKEN_001",
    ALREADY_MINTED_TODAY: "MINT_002",
    TRANSACTION_FAILED: "TX_001",
    UNDEFINED_ERROR: "SYS_001"
};

/**
 * Check if daily_mint instruction was already executed today by examining transaction history
 */
async function checkIfAlreadyMintedToday(): Promise<boolean> {
    try {
        console.log("🔍 Checking transaction history for today's minting...");
        
        // Get current date boundaries (start and end of today in UTC)
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);
        
        console.log("🔹 Checking period:", startOfToday.toISOString(), "to", endOfToday.toISOString());
        
        // Get recent transaction signatures for the company wallet
        const signatures = await connection.getSignaturesForAddress(
            companyWallet.publicKey,
            {
                limit: 100 // Check last 100 transactions
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
        
        // Check each transaction from today to see if it contains daily_mint instruction
        for (const sigInfo of todaySignatures) {
            try {
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
                    // Check transaction logs for daily_mint instruction
                    const logs = transaction.meta.logMessages || [];
                    const isDailyMint = logs.some(log => 
                        log.includes('Daily minted') || 
                        log.includes('daily_mint') ||
                        log.includes('Instruction: DailyMint')
                    );
                    
                    if (isDailyMint) {
                        const txDate = new Date(sigInfo.blockTime! * 1000);
                        console.log("❌ Found daily_mint transaction from today:");
                        console.log("🔹 Transaction:", sigInfo.signature);
                        console.log("🔹 Time:", txDate.toISOString());
                        return true;
                    }
                }
            } catch (error) {
                console.warn(`⚠️ Could not parse transaction ${sigInfo.signature}:`, error);
                // Continue checking other transactions
            }
        }
        
        console.log("✅ No daily_mint transactions found today - safe to mint");
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
            return MintResponseImpl.error(
                ERROR_CODES.MINT_NOT_FOUND,
                "Mint account does not exist"
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
            return MintResponseImpl.error(
                ERROR_CODES.TOKEN_ACCOUNT_NOT_FOUND,
                "Minting not possible: Company token account does not exist"
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
            return MintResponseImpl.error(
                ERROR_CODES.ALREADY_MINTED_TODAY,
                "Tokens have already been minted today. Try again tomorrow.",
                {
                    checkMethod: "transaction_history",
                    currentDate: new Date().toISOString()
                }
            );
        }

        // Amount to mint (5000 tokens)
        const amount = 5000 * (10 ** 9); // 5000 tokens with 9 decimals

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
            if (error instanceof Error) {
                console.log("-------------------------------------");
                console.error("Error message:", error.message);
                
                // Extract on-chain error code if available
                const errorMatch = error.message.match(/custom program error: (0x[0-9a-f]+)/i);
                const onChainErrorCode = errorMatch ? errorMatch[1] : null;
                
                return MintResponseImpl.error(
                    ERROR_CODES.TRANSACTION_FAILED,
                    `Transaction failed: ${error.message}`,
                    {
                        errorName: error.name,
                        onChainErrorCode
                    }
                );
            }
            
            const errorDetails = ErrorHandler.handle(error);
            return MintResponseImpl.error(
                ERROR_CODES.TRANSACTION_FAILED,
                "Transaction failed with unknown error",
                errorDetails
            );
        }
    } catch (e) {
        console.error("\n❌ ERROR:");
        const errorDetails = ErrorHandler.handle(e);
        
        return MintResponseImpl.error(
            ERROR_CODES.UNDEFINED_ERROR,
            `Unexpected error: ${errorDetails.message}`,
            errorDetails.details
        );
    }
}
