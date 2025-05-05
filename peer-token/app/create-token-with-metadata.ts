import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Connection, Keypair, SystemProgram, clusterApiUrl } from "@solana/web3.js";
import { 
    TOKEN_2022_PROGRAM_ID,
    getMint
} from "@solana/spl-token";
import * as fs from 'fs';
import * as path from 'path';
import { MPL_TOKEN_METADATA_PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";
import os from 'os';

// Convert Metaplex program ID to standard PublicKey
const METADATA_PROGRAM_ID = new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID);

// Set up the program ID (update with your deployed program ID)
const PROGRAM_ID = new PublicKey("B72Hy2z1KS5vvjkaKUv3tn5LG72PwjfnduX5rub35P77");

// Default token details (can be overridden by metadata file)
const DEFAULT_TOKEN_DECIMALS = 9;

// Path to Solana keypair
const KEYPAIR_PATH = '/Users/macbookpro/Solana/keys/wallet.json';

interface TokenMetadata {
    name: string;
    symbol: string;
    description: string;
    image: string;
    decimals?: number;
}

async function fetchMetadata(metadataUrl: string): Promise<TokenMetadata> {
    try {
        const response = await fetch(metadataUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch metadata: ${response.statusText}`);
        }
        const metadata = await response.json();
        
        // Validate required fields
        if (!metadata.name || !metadata.symbol || !metadata.image) {
            throw new Error("Metadata file must contain name, symbol, and image fields");
        }
        
        return {
            name: metadata.name,
            symbol: metadata.symbol,
            description: metadata.description || "",
            image: metadata.image,
            decimals: metadata.decimals || DEFAULT_TOKEN_DECIMALS
        };
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to fetch metadata: ${error.message}`);
        }
        throw new Error("Failed to fetch metadata: Unknown error");
    }
}

async function loadWallet(): Promise<Keypair> {
    try {
        console.log("\n💳 Loading wallet from Solana config...");
        if (!fs.existsSync(KEYPAIR_PATH)) {
            throw new Error(`Wallet not found at ${KEYPAIR_PATH}. Please ensure you have a Solana keypair generated.`);
        }
        
        const keypairData = JSON.parse(fs.readFileSync(KEYPAIR_PATH, 'utf-8'));
        const wallet = Keypair.fromSecretKey(new Uint8Array(keypairData));
        console.log("✅ Wallet loaded successfully:", wallet.publicKey.toString());
        return wallet;
    } catch (error) {
        console.error("❌ Error loading wallet:", error);
        throw error;
    }
}

async function main() {
    try {
        const metadataUrl = "https://raw.githubusercontent.com/utkuurkun/peer-token-metadata/refs/heads/main/token.json";
        console.log("\n🚀 Starting token creation with metadata...");
        console.log("🔹 Metadata URL:", metadataUrl);
        
        // Set up connection
        const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
        
        // Load existing wallet from Solana config
        const keypair = await loadWallet();
        
        // Check balance
        const balance = await connection.getBalance(keypair.publicKey);
        console.log("💰 Wallet balance:", balance / anchor.web3.LAMPORTS_PER_SOL, "SOL");
        
        // Fetch metadata
        const metadata = await fetchMetadata(metadataUrl);
        console.log("\n📋 Token Metadata:");
        console.log("🔹 Name:", metadata.name);
        console.log("🔹 Symbol:", metadata.symbol);
        console.log("🔹 Description:", metadata.description);
        console.log("🔹 Image:", metadata.image);
        console.log("🔹 Decimals:", metadata.decimals);

        // Create provider
        const provider = new anchor.AnchorProvider(
            connection,
            new anchor.Wallet(keypair),
            { commitment: "confirmed" }
        );
        anchor.setProvider(provider);

        // Load the IDL from the local file
        const idlPath = path.join(process.cwd(), "target", "idl", "peer_token.json");
        const idlFile = fs.readFileSync(idlPath, 'utf8');
        const idl = JSON.parse(idlFile);

        // Create program interface
        const program = new anchor.Program(idl, PROGRAM_ID, provider);

        console.log("\n====================================");
        console.log("🔄 Creating Token-2022 with Metadata");
        console.log("====================================");
        console.log("🔹 Program ID:", PROGRAM_ID.toString());
        
        // Derive the token mint PDA
        const [mintPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("peer-token")],
            PROGRAM_ID
        );
        
        console.log("🔹 Mint PDA:", mintPda.toString());

        // Check if mint already exists
        console.log("\n🔍 Checking if mint already exists...");
        const mintAccountInfo = await connection.getAccountInfo(mintPda);
        
        if (mintAccountInfo) {
            console.log("✅ Mint account already exists!");
            console.log("🔹 Mint Account Size:", mintAccountInfo.data.length);
            console.log("🔹 Mint Account Owner:", mintAccountInfo.owner.toString());
            
            try {
                // Get token mint info
                const mintInfo = await getMint(
                    connection,
                    mintPda,
                    "confirmed",
                    TOKEN_2022_PROGRAM_ID
                );
                console.log("🔹 Token Supply:", mintInfo.supply.toString());
                console.log("🔹 Decimals:", mintInfo.decimals);
                console.log("🔹 Mint Authority:", mintInfo.mintAuthority?.toString() || "None");
                console.log("🔹 Freeze Authority:", mintInfo.freezeAuthority?.toString() || "None");
            } catch (error) {
                if (error instanceof Error) {
                    console.log("❌ Could not fetch detailed mint info:", error.message);
                } else {
                    console.log("❌ Could not fetch detailed mint info: Unknown error");
                }
            }
        } else {
            console.log("❓ Mint account does not exist. Creating it now...");

            // Create the token mint
            const tx = await program.methods
                .createToken()
                .accounts({
                    peerAuthority: keypair.publicKey,
                    peerMint: mintPda,
                    systemProgram: SystemProgram.programId,
                    tokenProgram: TOKEN_2022_PROGRAM_ID,
                    rent: anchor.web3.SYSVAR_RENT_PUBKEY
                })
                .rpc();
            
            console.log("✅ Token mint created successfully");
            console.log("🔹 Transaction:", tx);
            console.log("🔹 Explorer URL:", `https://explorer.solana.com/tx/${tx}?cluster=devnet`);
        }

        // =========================================================
        // Create Metaplex Metadata for the Token-2022 token
        // =========================================================
        console.log("\n📋 Creating Metaplex Metadata for Token-2022 (FUNGIBLE token)");
        
        // Derive the metadata account PDA address using Metaplex convention
        const metadataAddress = PublicKey.findProgramAddressSync(
            [
                Buffer.from("metadata"),
                METADATA_PROGRAM_ID.toBuffer(),
                mintPda.toBuffer(),
            ],
            METADATA_PROGRAM_ID
        )[0];
        
        console.log("🔹 Metaplex Metadata Address:", metadataAddress.toString());
        console.log("🔹 This is a FUNGIBLE token with", metadata.decimals, "decimals");
        
        // Create Metaplex metadata for the Token-2022 token
        const createMetadataTx = await program.methods
            .createTokenMetadata(
                metadata.decimals,
                metadata.name,
                metadata.symbol,
                metadataUrl  // Using the JSON URL as the token URI instead of just the image
            )
            .accounts({
                payer: keypair.publicKey,
                mintAccount: mintPda,
                metadataAccount: metadataAddress,
                tokenMetadataProgram: METADATA_PROGRAM_ID,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                sysvarInstructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
                rent: new PublicKey("SysvarRent111111111111111111111111111111111"),
            })
            .rpc();
        
        console.log("✅ Metaplex metadata created successfully for FUNGIBLE Token-2022 token");
        console.log("🔹 Transaction:", createMetadataTx);
        console.log("🔹 Explorer URL:", `https://explorer.solana.com/tx/${createMetadataTx}?cluster=devnet`);

        // Verify the metadata was created
        console.log("\n🔍 Verifying metadata creation...");
        const metadataAccountInfo = await connection.getAccountInfo(metadataAddress);
        console.log("✅ Metadata Account Created:", metadataAccountInfo !== null);
        
        if (metadataAccountInfo) {
            console.log("🔹 Metadata Account Size:", metadataAccountInfo.data.length);
            console.log("🔹 Metadata Account Owner:", metadataAccountInfo.owner.toString());
        }

    } catch (error) {
        console.error("\n❌ ERROR:", error);
        if (error instanceof Error) {
            console.error("Error message:", error.message);
            console.error("Error stack:", error.stack);
        }
    }
}

main().then(() => console.log("\n✨ Done")); 