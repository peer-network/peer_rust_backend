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

// Set up the program ID
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID!);

interface TokenDistribution {
    tokenDistribution: {
        date: string;
        totalTokens: number;
        distributions: Array<{
            userId: string;
            walletAddress: string;
            gems: number;
            tokens: number;
        }>;
        summary: {
            totalGems: number;
            totalTokensDistributed: number;
        };
    };
}

async function main() {
    try {
        console.log("\n🚀 Starting token airdrop process...");
        
        // Set up connection
        const connection = new Connection(process.env.RPC_ENDPOINT || clusterApiUrl("devnet"), "confirmed");
        
        // Load company wallet keypair
        const companyKeypair = Keypair.fromSecretKey(
            Buffer.from(JSON.parse(fs.readFileSync(process.env.COMPANY_WALLET_PATH!, "utf-8")))
        );
        console.log("\n💼 Company wallet (token sender):", companyKeypair.publicKey.toString());

        // Create provider
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

        // Get company token account
        const companyTokenAccount = getAssociatedTokenAddressSync(
            mintPda,
            companyKeypair.publicKey,
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

        // Load TokenDistribution.json
        const distributionPath = path.join(process.cwd(), "app", "ata-validator", "data", "TokenDistribution.json");
        console.log("\n🔍 Looking for TokenDistribution.json at:", distributionPath);
        
        if (!fs.existsSync(distributionPath)) {
            throw new Error(`❌ TokenDistribution.json not found at: ${distributionPath}`);
        }

        // Read and parse distribution data
        const distributionData: TokenDistribution = JSON.parse(fs.readFileSync(distributionPath, 'utf8'));
        console.log(`\n📊 Total distributions to process: ${distributionData.tokenDistribution.distributions.length}`);

        // Process each distribution
        for (const distribution of distributionData.tokenDistribution.distributions) {
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

                // Execute transfer with proper decimal amount
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
        console.log(`Total distributions attempted: ${distributionData.tokenDistribution.distributions.length}`);
        console.log(`Total tokens distributed: ${distributionData.tokenDistribution.summary.totalTokensDistributed}`);

    } catch (error) {
        console.error("\n❌ ERROR:", error);
        if (error instanceof Error) {
            console.error("Error message:", error.message);
            console.error("Error stack:", error.stack);
        }
    }
}

main().then(() => console.log("\n✨ Airdrop process completed")); 