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
import {MintResponse, Status} from "../../../../solana_client/client/handlers/solanaProvider/SolanaProviderResponse";

class MintResponseImpl implements MintResponse {
    constructor(
        public code: string,
        public message: string,
        public status: Status,
        public data: any,
    ) {}

    static success(): MintResponseImpl {
        return new MintResponseImpl(
            "",
            "",
            Status.success,
            []
        )
    }

    static error(code : string, message: string): MintResponseImpl {
        return new MintResponseImpl(
            code,
            message,
            Status.error,
            []
        )
    }
}

dotenv.config();
// Set up the program ID
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID!);

export async function mint(): Promise<MintResponseImpl> {
    try {
        console.log("\n🚀 Starting daily token minting to company account...");
        
        // Set up connection
        const connection = new Connection(process.env.RPC_ENDPOINT ||clusterApiUrl("devnet"), "confirmed");
        
        // Load company wallet keypair
       
        const companyKeypair = Keypair.fromSecretKey(
            Buffer.from(JSON.parse(fs.readFileSync(process.env.COMPANY_WALLET_PATH!, "utf-8")))
        );
        console.log("\n💼 Company wallet:", companyKeypair.publicKey.toString());

        // Create provider with company wallet
        const provider = new anchor.AnchorProvider(
            connection,
            new anchor.Wallet(companyKeypair),
            { commitment: "confirmed" }
        );
        anchor.setProvider(provider);

        // Load the IDL
        // const idlPath = path.join(process.cwd(), "target", "idl", "peer_token.json");
        const idlFile = fs.readFileSync(process.env.IDL_PATH!, 'utf8');
        const idl = JSON.parse(idlFile);

        // Create program interface
        const program = new anchor.Program(idl, PROGRAM_ID, provider);

        // Derive the token mint PDA
        const [mintPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("peer-token")],
            (PROGRAM_ID)
        );
        console.log("\n🔹 Mint PDA:", mintPda.toString());

        // Get company's token account address
        const companyTokenAccount = getAssociatedTokenAddressSync(
            mintPda,
            companyKeypair.publicKey,
            false,
            TOKEN_2022_PROGRAM_ID
        );
        console.log("🔹 Company Token Account:", companyTokenAccount.toString());

        // Check if company token account exists
        const tokenAccountInfo = await connection.getAccountInfo(companyTokenAccount);
        if (!tokenAccountInfo) {
            throw new Error("❌ Minting not possible: Company token account does not exist");
        }

        // Derive the last mint account PDA
        const [lastMintPda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("daily-mint"),
                companyKeypair.publicKey.toBuffer()
            ],
            PROGRAM_ID
        );
        console.log("🔹 Last Mint PDA:", lastMintPda.toString());

        // Amount to mint (5000 tokens)
        const amount = 5000 * (10 ** 9); // 5000 tokens with 9 decimals

        console.log("\n⏳ Attempting daily mint to company account...");
        
        try {
            // Use the daily_mint instruction
            const tx = await program.methods
                .dailyMint(new anchor.BN(amount))
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
            return MintResponseImpl.success()
        } catch (error) {
            console.error("❌ Error during daily mint:", error);
            if (error instanceof Error) {
                console.error("Error message:", error.message);
                if (error.message.includes("AlreadyMintedToday")) {
                    console.log("ℹ️ Tokens have already been minted today. Try again tomorrow.");
                    return MintResponseImpl.error(
                       "40000",
                        "Tokens have already been minted today. Try again tomorrow."
                )
                }
                return MintResponseImpl.error(
                    "40000",
                    error.name + ": " + error.message
                )
            }
        }

    } catch (e) {
        const error = e as Error
        console.error("\n❌ ERROR:", error);
        if (error instanceof Error) {
            console.error("Error message:", error.message);
            console.error("Error stack:", error.stack);
        }
        return MintResponseImpl.error(
            "6000",
            error.name + ": " + error.message
        )
    }
    return MintResponseImpl.error(
            "60000",
            "Undefined error"
    )
}

// mint().then(() => console.log("\n✨ Done")); 