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

        // Derive the last mint account PDA
        const [lastMintPda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("daily-mint"),
                companyWallet.publicKey.toBuffer()
            ],
            program_id
        );
        console.log("-------------------------------------");
        console.log("🔹 Last Mint PDA:", lastMintPda.toString());

        // Amount to mint (5000 tokens)
        const amount = 5000 * (10 ** 9); // 5000 tokens with 9 decimals

        console.log("\n⏳ Attempting daily mint to company account...");
        
        try {
            // Use the daily_mint instruction
            const tx = await program.methods
                .dailyMint(new anchor.BN(amount))
                .accounts({
                    peerAuthority: companyWallet.publicKey,
                    peerMint: mintPda,
                    peerTokenAccount: companyTokenAccount,
                    lastMint: lastMintPda,
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
                
                if (error.message.includes("AlreadyMintedToday")) {
                    console.log("ℹ️ Tokens have already been minted today. Try again tomorrow.");
                    return MintResponseImpl.error(
                        ERROR_CODES.ALREADY_MINTED_TODAY,
                        "Tokens have already been minted today. Try again tomorrow."
                    );
                }
                
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
