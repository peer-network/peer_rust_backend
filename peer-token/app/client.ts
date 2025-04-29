import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Connection, Keypair, SystemProgram, clusterApiUrl } from "@solana/web3.js";
import { 
    TOKEN_2022_PROGRAM_ID, 
    TOKEN_PROGRAM_ID, 
    getAssociatedTokenAddressSync,
    ExtensionType,
    createInitializeMintCloseAuthorityInstruction,
    createInitializeMetadataPointerInstruction,
    getMint,
    ASSOCIATED_TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import * as fs from 'fs';
import * as path from 'path';
import { MPL_TOKEN_METADATA_PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";

// Convert Metaplex program ID to standard PublicKey
const METADATA_PROGRAM_ID = new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID);

// Set up the program ID (update with your deployed program ID)
const PROGRAM_ID = new PublicKey("5wzfDw7tg2z1UKsAmqBMVm43tXTQxd8wVZYBYLHHhotW");

// Token details
const TOKEN_NAME = "Peer Token Beta V3.5";
const TOKEN_SYMBOL = "PEER";
const TOKEN_URI = "https://media.peer-network.eu/image/PeerSignet_Color_RGB.png";
const TOKEN_DECIMALS = 9;
const MINT_AMOUNT = 1000_000_000; // 1000 tokens with 6 decimals

async function main() {
    try {
        // Set up connection and wallet
        const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
        
        // Load wallet from keypair file (ensure this path is correct)
        // const keypairPath = process.env.WALLET_PATH || path.join(require('os').homedir(), ".config", "solana", "id.json");
        const keypairPath = "/Users/macbookpro/Solana/keys/wallet.json";
        const keypair = Keypair.fromSecretKey(
            Buffer.from(JSON.parse(fs.readFileSync(keypairPath, "utf-8")))
        );
        console.log("\n💳 Using wallet:", keypair.publicKey.toString());

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
        console.log("🔄 Starting Token Operations Tests");
        console.log("====================================");
        console.log("🔹 Program ID:", PROGRAM_ID.toString());
        
        // =========================================================
        // 1. Create Token Mint using Token-2022 program
        // =========================================================
        console.log("\n📋 STEP 1: Creating Token-2022 Mint");
        
        // Derive the token mint PDA
        const [mintPda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("peer-token"),
            ],
            PROGRAM_ID
        );
        
        console.log("🔹 Mint PDA:", mintPda.toString());

        // Create the token mint with Token-2022
        const createMintTx = await program.methods
            .createToken(TOKEN_NAME)
            .accounts({
                signer: keypair.publicKey,
                mint: mintPda,
                tokenProgram: TOKEN_2022_PROGRAM_ID,  // Use Token-2022 program
                systemProgram: SystemProgram.programId,
            })
            .rpc();
        
        console.log("✅ Token-2022 mint created successfully");
        console.log("🔹 Transaction:", createMintTx);
        console.log("🔹 Explorer URL:", `https://explorer.solana.com/tx/${createMintTx}?cluster=devnet`);
        
        // // =========================================================
        // // 2. Create Metaplex Metadata for the Token-2022 token
        // // =========================================================
        // console.log("\n📋 STEP 2: Creating Metaplex Metadata for Token-2022 (FUNGIBLE token)");
        
        // // Derive the metadata account PDA address using Metaplex convention
        // const metadataAddress = PublicKey.findProgramAddressSync(
        //     [
        //         Buffer.from("metadata"),
        //         METADATA_PROGRAM_ID.toBuffer(),
        //         mintPda.toBuffer(),
        //     ],
        //     METADATA_PROGRAM_ID
        // )[0];
        
        // console.log("🔹 Metaplex Metadata Address:", metadataAddress.toString());
        // console.log("�� This is a FUNGIBLE token with", TOKEN_DECIMALS, "decimals");
        
        // // Create Metaplex metadata for the Token-2022 token
        // const createMetadataTx = await program.methods
        //     .createTokenMetadata(
        //         TOKEN_DECIMALS,
        //         TOKEN_NAME,
        //         TOKEN_SYMBOL,
        //         TOKEN_URI
        //     )
        //     .accounts({
        //         payer: keypair.publicKey,
        //         mintAccount: mintPda,
        //         metadataAccount: metadataAddress,
        //         tokenMetadataProgram: METADATA_PROGRAM_ID,
        //         tokenProgram: TOKEN_2022_PROGRAM_ID,
        //         systemProgram: SystemProgram.programId,
        //         rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        //     })
        //     .rpc();
        
        // console.log("✅ Metaplex metadata created successfully for FUNGIBLE Token-2022 token");
        // console.log("🔹 Transaction:", createMetadataTx);
        // console.log("🔹 Explorer URL:", `https://explorer.solana.com/tx/${createMetadataTx}?cluster=devnet`);
        
        // =========================================================
        // 3. Create a Token Account (PDA-based)
        // =========================================================
//         console.log("\n📋 STEP 3: Creating PDA Token Account");
        
//         // Derive the token account PDA
//         const [tokenAccountPda] = PublicKey.findProgramAddressSync(
//             [
//                 Buffer.from("token-2022-token-account"),
//                 keypair.publicKey.toBuffer(),
//                 mintPda.toBuffer()
//             ],
//             PROGRAM_ID
//         );
        
//         console.log("🔹 Token Account PDA:", tokenAccountPda.toString());
        
//         // Create token account
//         const createTokenAccountTx = await program.methods
//             .createTokenAccount()
//             .accounts({
//                 signer: keypair.publicKey,
//                 mint: mintPda,
//                 tokenAccount: tokenAccountPda,
//                 tokenProgram: TOKEN_2022_PROGRAM_ID,
//                 systemProgram: SystemProgram.programId
//             })
//             .rpc();
        
//         console.log("✅ Token account created successfully");
//         console.log("🔹 Transaction:", createTokenAccountTx);
//         console.log("🔹 Explorer URL:", `https://explorer.solana.com/tx/${createTokenAccountTx}?cluster=devnet`);
        
//         // =========================================================
//         // 4. Create an Associated Token Account
//         // =========================================================
//         console.log("\n📋 STEP 4: Creating Associated Token Account");
        
//         // Calculate the ATA address
//         const ata = getAssociatedTokenAddressSync(
//             mintPda,
//             keypair.publicKey,
//             false,
//             TOKEN_2022_PROGRAM_ID
//         );
        
//         console.log("🔹 Associated Token Account:", ata.toString());
        
//         // Create associated token account
//         const createAtaTx = await program.methods
//             .createAssociatedTokenAccount()
//             .accounts({
//                 signer: keypair.publicKey,
//                 mint: mintPda,
//                 tokenAccount: ata,
//                 tokenProgram: TOKEN_2022_PROGRAM_ID,
//                 associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
//                 systemProgram: SystemProgram.programId
//             })
//             .rpc();
        
//         console.log("✅ Associated token account created successfully");
//         console.log("🔹 Transaction:", createAtaTx);
//         console.log("🔹 Explorer URL:", `https://explorer.solana.com/tx/${createAtaTx}?cluster=devnet`);
        
//         // =========================================================
//         // 5. Mint Tokens to the PDA Token Account
//         // =========================================================
//         console.log("\n📋 STEP 5: Minting Tokens to PDA Token Account");
        
//         // Mint tokens to the token account
//         const mintTokensTx = await program.methods
//             .mintToken(new anchor.BN(MINT_AMOUNT))
//             .accounts({
//                 signer: keypair.publicKey,
//                 mint: mintPda,
//                 receiver: tokenAccountPda,
//                 tokenProgram: TOKEN_2022_PROGRAM_ID
//             })
//             .rpc();
        
//         console.log(`✅ Minted ${MINT_AMOUNT / (10 ** TOKEN_DECIMALS)} tokens to PDA token account`);
//         console.log("🔹 Transaction:", mintTokensTx);
//         console.log("🔹 Explorer URL:", `https://explorer.solana.com/tx/${mintTokensTx}?cluster=devnet`);
        
//         // =========================================================
//         // 6. Transfer Tokens to a New Wallet
//         // =========================================================
//         console.log("\n📋 STEP 6: Transferring Tokens to a New Wallet");
        
//         // Create a new wallet to send tokens to
//         const destinationWallet = Keypair.generate();
        
//         console.log("🔹 Destination Wallet:", destinationWallet.publicKey.toString());
        
//         // Calculate destination ATA
//         const destinationAta = getAssociatedTokenAddressSync(
//             mintPda,
//             destinationWallet.publicKey,
//             false,
//             TOKEN_2022_PROGRAM_ID
//         );
        
//         console.log("🔹 Destination ATA (will be created):", destinationAta.toString());
        
//         // Amount to transfer (10 tokens)
//         const transferAmount = 100 * (10 ** TOKEN_DECIMALS);
        
//         // Transfer tokens
//         const transferTokensTx = await program.methods
//             .transferToken(new anchor.BN(transferAmount))
//             .accounts({
//                 signer: keypair.publicKey,
//                 from: tokenAccountPda,
//                 to: destinationWallet.publicKey,
//                 toAta: destinationAta,
//                 mint: mintPda,
//                 tokenProgram: TOKEN_2022_PROGRAM_ID,
//                 associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
//                 systemProgram: SystemProgram.programId
//             })
//             .rpc();
        
//         console.log(`✅ Transferred ${transferAmount / (10 ** TOKEN_DECIMALS)} tokens to destination wallet`);
//         console.log("🔹 Transaction:", transferTokensTx);
//         console.log("🔹 Explorer URL:", `https://explorer.solana.com/tx/${transferTokensTx}?cluster=devnet`);
        
//         // =========================================================
//         // Verify Balances
//         // =========================================================
//         console.log("\n📋 STEP 7: Verifying Token Balances");

//         // Allow time for transactions to confirm
//         await new Promise(resolve => setTimeout(resolve, 2000));

//         // Get PDA token account info
//         const pdaAccountInfo = await connection.getTokenAccountBalance(tokenAccountPda);
//         console.log(`🔹 PDA Token Account Balance: ${pdaAccountInfo.value.uiAmount} ${TOKEN_SYMBOL}`);

//         // Get destination ATA account info
//         const destinationAtaInfo = await connection.getTokenAccountBalance(destinationAta);
//         console.log(`🔹 Destination ATA Balance: ${destinationAtaInfo.value.uiAmount} ${TOKEN_SYMBOL}`);

//         console.log("\n====================================");
//         console.log("✅ All Token Operations Completed Successfully");
//         console.log("====================================");

    } catch (error) {
        console.error("\n❌ Error during execution:");
        if (error instanceof Error) {
            console.error("Error message:", error.message);
            console.error("Error stack:", error.stack);
        } else {
            console.error("Unknown error:", error);
        }
    }
}

main().then(() => console.log("\nScript execution completed."));