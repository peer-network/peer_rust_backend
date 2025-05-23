import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Connection, Keypair, SystemProgram, clusterApiUrl } from "@solana/web3.js";
import { 
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddressSync,
    getMint,
    unpackAccount
} from "@solana/spl-token";
import * as fs from 'fs';
import * as path from 'path';
import { BN } from "bn.js";
// import * as dotenv from 'dotenv';
import { getPublicKey, getKeypairFromEnvPath, getSolanaConnection, getIdl, getTokenDecimals, getDailyMintAmount } from "../../utils";
import { tokenDistribution } from "../mockdata/distribution";
import { ErrorHandler, ErrorFactory, ErrorCode, Validators } from "../errors";


// Load environment variables
// dotenv.config();
const connection = getSolanaConnection();
const companyWallet = getKeypairFromEnvPath("COMPANY_WALLET_PATH");
const idl = getIdl();
const token_decimals = getTokenDecimals("TOKEN_DECIMALS");
const daily_mint_amount = getDailyMintAmount("DAILY_MINT_AMOUNT");

// Set up the program ID from env
const program_id = getPublicKey("PROGRAM_ID");

export interface TokenDistribution {
    data: {
        GetGemsForDay: {
            status: string;
            ResponseCode: string;
            Date: string;
            affectedRows: {
                data: Array<{
                    userId?: string;
                    walletAddress?: string;
                    tokens?: string | number;
                }>;
                totalTokens?: string;
            };
        };
    };
}

async function mintToCompany(
    program: Program,
    connection: Connection,
    companyKeypair: Keypair,
    mintPda: PublicKey,
    companyTokenAccount: PublicKey
): Promise<void> {
    console.log("\n🚀 Step 1: Daily Minting to Company Account");

    // Derive the last mint account PDA
    const [lastMintPda] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("daily-mint"),
            companyKeypair.publicKey.toBuffer()
        ],
        program_id
    );
    console.log("🔹 Last Mint PDA:", lastMintPda.toString());

    // Amount to mint (5000 tokens with 9 decimals)
    const amount = daily_mint_amount * (10 ** token_decimals);

    try {
        const tx = await program.methods
            .dailyMint(new BN(amount))
            .accounts({
                peerAuthority: companyKeypair.publicKey,
                peerMint: mintPda,
                peerTokenAccount: companyTokenAccount,
                lastMint: lastMintPda,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                systemProgram: SystemProgram.programId
            })
            .signers([companyKeypair])
            .rpc();
            
        console.log("✅ Daily mint successful");
        console.log("🔹 Transaction:", tx);
        console.log("🔹 Explorer URL:", `https://explorer.solana.com/tx/${tx}?cluster=devnet`);
        
        // Verify the mint
        const tokenAccountInfo = await connection.getTokenAccountBalance(companyTokenAccount);
        console.log("\n💰 Company Token Balance:", tokenAccountInfo.value.uiAmount);
    } catch (error) {
        const errorInfo = ErrorHandler.handle(error);
        
        // Business logic: "Already minted today" is not a failure condition
        // It means we can proceed with distribution
        if (errorInfo.code === ErrorCode.ALREADY_MINTED_TODAY) {
            console.log("ℹ️ Tokens have already been minted today. Proceeding with distribution.");
            return; // Continue with the process
        }
        
        // All other errors are genuine failures
        throw error; // Re-throw the original error, already handled by ErrorHandler
    }
}

async function createUserTokenAccounts(
    program: Program,
    connection: Connection,
    companyKeypair: Keypair,
    mintPda: PublicKey,
    distributions: TokenDistribution["data"]["GetGemsForDay"]["affectedRows"]["data"]
): Promise<void> {
    console.log("\n🚀 Step 2: Creating User Token Accounts");
    
    let successfulCreations = 0;
    let failedCreations = 0;

    for (const distribution of distributions) {
        if (!distribution.userId || !distribution.walletAddress) {
            console.error(`❌ User ${distribution.userId || 'unknown'} has no wallet address`);
            failedCreations++;
            continue;
        }
        
        console.log(`\n👤 Processing User: ${distribution.userId}`);
        console.log(`🔑 Wallet: ${distribution.walletAddress}`);

        try {
            // Validate wallet address
            const userWallet = Validators.publicKey(distribution.walletAddress, "user wallet address");
            
            const userTokenAccount = getAssociatedTokenAddressSync(
                mintPda,
                userWallet,
                false,
                TOKEN_2022_PROGRAM_ID
            );

            const accountInfo = await connection.getAccountInfo(userTokenAccount);
            if (!accountInfo) {
                const tx = await program.methods
                    .createUserTokenAccount()
                    .accounts({
                        peerAuthority: companyKeypair.publicKey,
                        userWallet: userWallet,
                        peerMint: mintPda,
                        userTokenAccount: userTokenAccount,
                        systemProgram: SystemProgram.programId,
                        tokenProgram: TOKEN_2022_PROGRAM_ID,
                        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
                    })
                    .signers([companyKeypair])
                    .rpc();

                console.log("✅ Token account created");
                console.log("🔹 Transaction:", tx);
                console.log("🔹 Explorer URL:", `https://explorer.solana.com/tx/${tx}?cluster=devnet`);
                successfulCreations++;
            } else {
                console.log("ℹ️ Token account already exists");
                successfulCreations++;
            }
        } catch (error) {
            console.error(`❌ Error creating token account for ${distribution.userId}:`);
            ErrorHandler.handle(error);
            failedCreations++;
        }
    }
    
    console.log(`\n📊 ACCOUNT CREATION SUMMARY:`);
    console.log(`✅ Successful: ${successfulCreations} accounts`);
    console.log(`❌ Failed: ${failedCreations} accounts`);
}

async function distributeTokens(
    program: Program,
    connection: Connection,
    companyKeypair: Keypair,
    mintPda: PublicKey,
    companyTokenAccount: PublicKey,
    distributions: TokenDistribution["data"]["GetGemsForDay"]["affectedRows"]["data"]
): Promise<void> {
    console.log("\n🚀 Step 3: Distributing Tokens");

    // Format token amounts based on decimals
    const formatAmount = (amount: number | bigint) => {
        return Number(amount) / (10 ** token_decimals);
    };

    // Check initial company balance
    const initialCompanyInfo = await connection.getAccountInfo(companyTokenAccount);
    if (!initialCompanyInfo) {
        throw ErrorFactory.tokenAccountNotFound(companyTokenAccount, companyKeypair.publicKey);
    }
    
    const initialAccount = unpackAccount(companyTokenAccount, initialCompanyInfo, TOKEN_2022_PROGRAM_ID);
    console.log(`💰 Initial company token balance: ${formatAmount(initialAccount.amount)} tokens`);

    let successfulTransfers = 0;
    let failedTransfers = 0;
    let totalTokensDistributed = 0;

    for (const distribution of distributions) {
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
            const userWallet = Validators.publicKey(distribution.walletAddress, "user wallet address");
            
            // Validate token amount
            const tokens = Number(distribution.tokens);
            if (isNaN(tokens) || tokens <= 0) {
                throw new Error(`Invalid token amount for user ${distribution.userId}: ${distribution.tokens}`);
            }
            
            const userTokenAccount = getAssociatedTokenAddressSync(
                mintPda,
                userWallet,
                false,
                TOKEN_2022_PROGRAM_ID
            );
            console.log("🔹 User Token Account:", userTokenAccount.toString());
            
            // Verify the user token account exists
            const userAccountInfo = await connection.getAccountInfo(userTokenAccount);
            if (!userAccountInfo) {
                throw ErrorFactory.tokenAccountNotFound(userTokenAccount, userWallet);
            }

            // Convert token amount to proper decimal representation
            const transferAmount = tokens * (10 ** token_decimals);

            const tx = await program.methods
                .transferTokens(new BN(transferAmount))
                .accounts({
                    peerAuthority: companyKeypair.publicKey,
                    userWallet: userWallet,
                    peerMint: mintPda,
                    peerTokenAccount: companyTokenAccount,
                    userTokenAccount: userTokenAccount,
                    tokenProgram: TOKEN_2022_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                })
                .signers([companyKeypair])
                .rpc();

            console.log("✅ Transfer successful!");
            console.log("🔹 Transaction:", tx);
            console.log("🔹 Explorer URL:", `https://explorer.solana.com/tx/${tx}?cluster=devnet`);

            // Wait for confirmation and check new balance
            await connection.confirmTransaction(tx);
            const accountInfo = await connection.getAccountInfo(userTokenAccount);
            if (accountInfo) {
                const account = unpackAccount(userTokenAccount, accountInfo, TOKEN_2022_PROGRAM_ID);
                console.log(`💰 New token balance: ${formatAmount(account.amount)} tokens`);
            }
            
            successfulTransfers++;
            totalTokensDistributed += tokens;
        } catch (error) {
            console.error(`❌ Error processing transfer for user ${distribution.userId}:`);
            ErrorHandler.handle(error);
            failedTransfers++;
        }
    }

    // Check final company balance
    const finalCompanyInfo = await connection.getAccountInfo(companyTokenAccount);
    if (finalCompanyInfo) {
        const finalAccount = unpackAccount(companyTokenAccount, finalCompanyInfo, TOKEN_2022_PROGRAM_ID);
        console.log(`\n💰 Final company token balance: ${formatAmount(finalAccount.amount)} tokens`);
    }
    
    console.log("\n📊 DISTRIBUTION SUMMARY:");
    console.log(`✅ Successful transfers: ${successfulTransfers}`);
    console.log(`❌ Failed transfers: ${failedTransfers}`);
    console.log(`💰 Total tokens distributed: ${totalTokensDistributed}`);
}

async function main() {
    try {
        console.log("\n🚀 Starting Complete Token Distribution Process");
        
        // Set up connection
        const connection = getSolanaConnection();
        
        console.log("\n💼 Company wallet:", companyWallet.publicKey.toString());

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

        // Check if mint exists
        const mintAccountInfo = await connection.getAccountInfo(mintPda);
        if (!mintAccountInfo) {
            throw ErrorFactory.mintNotFound(mintPda);
        }
        
        console.log("✅ Mint account exists!");

        // Get company token account
        const companyTokenAccount = getAssociatedTokenAddressSync(
            mintPda,
            companyWallet.publicKey,
            false,
            TOKEN_2022_PROGRAM_ID
        );
        console.log("🔹 Company Token Account:", companyTokenAccount.toString());

        // Load TokenDistribution.json
        const distributionPath = path.join(process.cwd(), "peer-token", "app", "token_operations", "data", "TokenDistribution.json");
        console.log("\n🔍 Loading TokenDistribution.json from:", distributionPath);
        
        let distributionData: TokenDistribution;
        
        if (fs.existsSync(distributionPath)) {
            try {
                distributionData = JSON.parse(fs.readFileSync(distributionPath, 'utf8'));
            } catch (error) {
                if (error instanceof SyntaxError) {
                    throw ErrorFactory.transactionFailed("JSON parsing", error);
                }
                throw error;
            }
        } else {
            console.log("⚠️ TokenDistribution.json not found, using mock data");
            distributionData = tokenDistribution as unknown as TokenDistribution;
        }
        
        // Validate distribution data
        if (!distributionData?.data?.GetGemsForDay?.affectedRows?.data || 
            !Array.isArray(distributionData.data.GetGemsForDay.affectedRows.data)) {
            throw ErrorFactory.transactionFailed("data validation", new Error("Invalid data structure: missing data.GetGemsForDay.affectedRows.data array"));
        }

        const distributions = distributionData.data.GetGemsForDay.affectedRows.data;
        console.log(`📊 Total distributions to process: ${distributions.length}`);

        // Execute all steps in sequence
        await mintToCompany(program, connection, companyWallet, mintPda, companyTokenAccount);
        await createUserTokenAccounts(program, connection, companyWallet, mintPda, distributions);
        await distributeTokens(program, connection, companyWallet, mintPda, companyTokenAccount, distributions);

        console.log("\n📝 SUMMARY:");
        console.log(`Total distributions completed: ${distributions.length}`);
        console.log(`Total tokens distributed: ${distributionData.data.GetGemsForDay.affectedRows.totalTokens || 'Unknown'}`);

    } catch (error) {
        console.error("\n❌ ERROR DURING TOKEN DISTRIBUTION:");
        const errorDetails = ErrorHandler.handle(error);
        console.error(`Error code: ${errorDetails.code}, Message: ${errorDetails.message}`);
        
        if (errorDetails.details) {
            console.error("Error details:", JSON.stringify(errorDetails.details, null, 2));
        }
        
        process.exit(1);
    }
}

// Run the main function if this is the entry point
if (require.main === module) {
    main().then(() => console.log("\n✨ Complete token distribution process finished"));
}

export { main, mintToCompany, createUserTokenAccounts, distributeTokens }; 