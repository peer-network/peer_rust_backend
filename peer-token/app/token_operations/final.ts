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
import { getPublicKey, getKeypairFromEnvPath, getSolanaConnection, getIdl, getTokenDecimals, getDailyMintAmount } from "../../utilss";
import { tokenDistribution } from "../mockdata/distribution";


// Load environment variables
// dotenv.config();
const connection = getSolanaConnection();
const companyWallet = getKeypairFromEnvPath("COMPANY_WALLET_PATH");
const idl = getIdl();
const token_decimals = getTokenDecimals("TOKEN_DECIMALS");
const daily_mint_amount = getDailyMintAmount("DAILY_MINT_AMOUNT");

// Set up the program ID from env
const program_id = getPublicKey("PROGRAM_ID");

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
        if (error instanceof Error && error.message.includes("AlreadyMintedToday")) {
            console.log("ℹ️ Tokens have already been minted today. Proceeding with distribution.");
        } else {
            throw error;
        }
    }
}

async function createUserTokenAccounts(
    program: Program,
    connection: Connection,
    companyKeypair: Keypair,
    mintPda: PublicKey,
    TokenDistribution: TokenDistribution,
    // distributions: TokenDistribution["data"]["GetGemsForDay"]["affectedRows"]["data"]
): Promise<void> {
    console.log("\n🚀 Step 2: Creating User Token Accounts");

     
    for (const tokenDistribution of  ) {
        if (!distribution.walletAddress) {
            console.error(`❌ User ${distribution.userId} has no wallet address`);
            continue;
        }
        const userWallet = new PublicKey(distribution.walletAddress);
        console.log(`\n👤 Processing User: ${distribution.userId}`);
        console.log(`🔑 Wallet: ${distribution.walletAddress}`);

        try {
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
            } else {
                console.log("ℹ️ Token account already exists");
            }
        } catch (error) {
            console.error(`❌ Error creating token account for ${distribution.userId}:`, error);
        }
    }
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

    // Check initial company balance
    const initialCompanyInfo = await connection.getAccountInfo(companyTokenAccount);
    if (initialCompanyInfo) {
        const initialAccount = unpackAccount(companyTokenAccount, initialCompanyInfo, TOKEN_2022_PROGRAM_ID);
        console.log(`💰 Initial company token balance: ${Number(initialAccount.amount) / (10 ** Number(process.env.TOKEN_DECIMALS!))} tokens`);
    }

    for (const distribution of distributions) {
        console.log("\n====================================");
        console.log(`👤 Processing User ID: ${distribution.userId}`);
        console.log(`🔑 Wallet: ${distribution.walletAddress}`);
        console.log(`💰 Tokens to send: ${distribution.tokens}`);

        try {
            const userWallet = new PublicKey(distribution.walletAddress!);
            const userTokenAccount = getAssociatedTokenAddressSync(
                mintPda,
                userWallet,
                false,
                TOKEN_2022_PROGRAM_ID
            );
            console.log("🔹 User Token Account:", userTokenAccount.toString());

            // Convert token amount to proper decimal representation
            const transferAmount = Number(distribution.tokens) * (10 ** Number(process.env.TOKEN_DECIMALS!));

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

            // Wait for confirmation and check new balance
            await connection.confirmTransaction(tx);
            const accountInfo = await connection.getAccountInfo(userTokenAccount);
            if (accountInfo) {
                const account = unpackAccount(userTokenAccount, accountInfo, TOKEN_2022_PROGRAM_ID);
                console.log(`💰 New token balance: ${Number(account.amount) / (10 ** Number(process.env.TOKEN_DECIMALS!))} tokens`);
            }
        } catch (error) {
            console.error(`❌ Error processing transfer for user ${distribution.userId}:`, error);
            if (error instanceof Error) console.error(error.message);
        }
    }

    // Check final company balance
    const finalCompanyInfo = await connection.getAccountInfo(companyTokenAccount);
    if (finalCompanyInfo) {
        const finalAccount = unpackAccount(companyTokenAccount, finalCompanyInfo, TOKEN_2022_PROGRAM_ID);
        console.log(`\n💰 Final company token balance: ${Number(finalAccount.amount) / (10 ** Number(process.env.TOKEN_DECIMALS!))} tokens`);
    }
}

async function main() {
    try {
        console.log("\n🚀 Starting Complete Token Distribution Process");
        
        // Set up connection
        const connection = getSolanaConnection();
        
        // Load company wallet keypair
        // const companyKeypair = Keypair.fromSecretKey(
        //     Buffer.from(JSON.parse(fs.readFileSync(companyWallet.publicKey.toBase58(), "utf-8")))
        // );
        console.log("\n💼 Company wallet:", companyWallet.publicKey.toString());

        // Create provider
        const provider = new anchor.AnchorProvider(
            connection,
            new anchor.Wallet(companyWallet),
            { commitment: "confirmed" }
        );
        anchor.setProvider(provider);

        // Load the IDL
        // const idlPath = path.join(process.cwd(), "target", "idl", "peer_token.json");
        // const idlFile = fs.readFileSync(process.env.IDL_PATH!, 'utf8');
        // const idl = JSON.parse(idlFile);

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

        // Load TokenDistribution.json
        // const distributionPath = path.join(process.cwd(), "app", "ata-validator", "data", "TokenDistribution.json");
        const distributionPath = path.join(process.cwd(), "peer-token", "app", "token_operations", "data", "TokenDistribution.json");
        const TokenDistribution = JSON.parse(fs.readFileSync(distributionPath, 'utf8'));
        console.log("\n🔍 Loading TokenDistribution.json from:", distributionPath);
        
        if (!fs.existsSync(distributionPath)) {
            throw new Error(`❌ TokenDistribution.json not found at: ${distributionPath}`);
        }

        const distributionData: TokenDistribution = JSON.parse(fs.readFileSync(distributionPath, 'utf8'));
        console.log(`📊 Total distributions to process: ${distributionData.data.GetGemsForDay.affectedRows.data.length}`);

        // Execute all steps in sequence
        await mintToCompany(program, connection, companyWallet, mintPda, companyTokenAccount);
        await createUserTokenAccounts(program, connection, companyWallet, mintPda, distributionData.data.GetGemsForDay.affectedRows.data);
        await distributeTokens(program, connection, companyWallet, mintPda, companyTokenAccount, distributionData.data.GetGemsForDay.affectedRows.data);

        console.log("\n📝 SUMMARY:");
        console.log(`Total distributions completed: ${distributionData.data.GetGemsForDay.affectedRows.data.length}`);
        console.log(`Total tokens distributed: ${distributionData.data.GetGemsForDay.affectedRows.totalTokens}`);

    } catch (error) {
        console.error("\n❌ ERROR:", error);
        if (error instanceof Error) {
            console.error("Error message:", error.message);
            console.error("Error stack:", error.stack);
        }
    }
}

main().then(() => console.log("\n✨ Complete token distribution process finished")); 