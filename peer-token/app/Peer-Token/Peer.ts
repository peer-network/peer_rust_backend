import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { 
    PublicKey, 
    Connection, 
    Keypair, 
    SystemProgram, 
    clusterApiUrl 
} from "@solana/web3.js";
import { 
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddressSync,
    getMint
} from "@solana/spl-token";
import { Metaplex, keypairIdentity } from "@metaplex-foundation/js";
import * as fs from 'fs';
import path from 'path';
<<<<<<< HEAD
import dotenv from 'dotenv';
import { getPublicKey, getKeypairFromEnvPath, getSolanaConnection, getIdl } from "../../utilss";
import { ErrorHandler, ErrorFactory, ErrorCode } from "../errors";
=======
 import dotenv from 'dotenv';
 import { getPublicKey, getKeypairFromEnvPath, getSolanaConnection, getIdl } from "../../utilss";
>>>>>>> development

dotenv.config( { path:path.resolve(__dirname, "../../.env")});

// Program and Token Constants
const program_id = getPublicKey("PROGRAM_ID");
const TOKEN_METADATA_PROGRAM_ID = getPublicKey("TOKEN_METADATA_PROGRAM_ID");
const TOKEN_2022_PROGRAM_ID = getPublicKey("TOKEN_2022_PROGRAM_ID");
const companyWallet = getKeypairFromEnvPath("COMPANY_WALLET_PATH");
const connection = getSolanaConnection();
const idl = getIdl();


async function main() {
    try {
        // Get command line arguments
        const operation = process.argv[2] || 'all'; // 'all', 'mint', 'company', 'metadata', 'update'
        const tokenName = process.argv[3] || "Peer Token";
        const tokenSymbol = process.argv[4] || "PEER";
        const tokenUri = process.argv[5] || "https://raw.githubusercontent.com/utkuurkun/peer-token-metadata/refs/heads/main/token.json";

        console.log("\n🚀 Starting Peer Token Operation");
        console.log("============================");
        console.log("Operation:", operation);
        console.log("Token Name:", tokenName);
        console.log("Token Symbol:", tokenSymbol);
        console.log("Token URI:", tokenUri);
        
       
        console.log("\n💳 Using Company wallet:", companyWallet.publicKey.toString());

        // Setup providers and programs
        const provider = new anchor.AnchorProvider(
            connection,
            new anchor.Wallet(companyWallet),
            { commitment: "confirmed" }
        );
        anchor.setProvider(provider);

       
        const program = new anchor.Program(idl, program_id, provider);

        // Derive PDAs
        const [mintPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("peer-token")],
            program_id
        );
        console.log("\n🔑 PDAs and Accounts");
        console.log("-------------------");
        console.log("Mint PDA:", mintPda.toString());

        // Setup Metaplex
        const metaplex = Metaplex.make(connection)
            .use(keypairIdentity(companyWallet));  

        // 1. MINT TOKEN
        if (operation === 'all' || operation === 'mint') {
            console.log("-------------------------------------");
            console.log("\n📝 STEP 1: Creating Token Mint");
            console.log("----------------------------");

            const mintAccountInfo = await connection.getAccountInfo(mintPda);

            
            if (mintAccountInfo) {
                console.log("✅ Mint account already exists!");
                console.log("🔹 Account Size:", mintAccountInfo.data.length);
                console.log("🔹 Owner:", mintAccountInfo.owner.toString());

                try {
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
                    ErrorHandler.logError(error);
                    console.log("❌ Could not fetch mint information");
                }
            } else {
                try {
                    console.log("❓ Mint account does not exist, Creating mint account");
                    const tx = await program.methods
                        .createToken()
                        .accounts({
                            peerAuthority: companyWallet.publicKey,
                            peerMint: mintPda,
                            systemProgram: SystemProgram.programId,
                            tokenProgram: TOKEN_2022_PROGRAM_ID,
                            rent: anchor.web3.SYSVAR_RENT_PUBKEY
                        })
                        .signers([companyWallet])
                        .rpc();

                    console.log("✅ Token mint created successfully");
                    console.log("🔹 Transaction:", tx);
                    console.log("🔹 Explorer URL:", `https://explorer.solana.com/tx/${tx}?cluster=devnet`);

                    // Verify mint creation
                    const mintInfo = await getMint(
                        connection,
                        mintPda,
                        "confirmed",
                        TOKEN_2022_PROGRAM_ID
                    );
                    console.log("\n🔍 Verifying mint creation...");
                    console.log("✅ Mint Account Created:", mintInfo !== null);

                    console.log("🔹 Token Supply:", mintInfo.supply.toString());
                    console.log("🔹 Decimals:", mintInfo.decimals);
                    console.log("🔹 Mint Authority:", mintInfo.mintAuthority?.toString() || "None");
                    console.log("🔹 Freeze Authority:", mintInfo.freezeAuthority?.toString() || "None");
                } catch (error) {
                    throw ErrorFactory.transactionFailed("create token mint", error);
                }
            }
        }

        // 2. COMPANY TOKEN ACCOUNT
        if (operation === 'all' || operation === 'company') {
            console.log("-------------------------------------");
            console.log("\n📝 STEP 2: Creating Company Token Account");
            console.log("-------------------------------------");

            const mintAccountInfo = await connection.getAccountInfo(mintPda);

            if(!mintAccountInfo){
                throw ErrorFactory.mintNotFound(mintPda);
            }

            const companyAta = getAssociatedTokenAddressSync(
                mintPda,
                companyWallet.publicKey,
                false,
                TOKEN_2022_PROGRAM_ID
            );
            console.log("🔹 Company Token Account Address:", companyAta.toString());

            const companyAtaInfo = await connection.getAccountInfo(companyAta);
            
            if (companyAtaInfo) {
                console.log("✅ Company token account already exists!");
                console.log("🔹 Account Size:", companyAtaInfo.data.length);
                console.log("🔹 Owner Program:", companyAtaInfo.owner.toString());
            } else {
                try {
                    console.log("❓ Company token account does not exist, Creating company token account");
                    const tx = await program.methods
                        .createAssociatedTokenAccount()
                        .accounts({
                            signer: companyWallet.publicKey,
                            peerMint: mintPda,
                            peerTokenAccount: companyAta,
                            systemProgram: SystemProgram.programId,
                            tokenProgram: TOKEN_2022_PROGRAM_ID,
                            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
                        })
                        .signers([companyWallet])
                        .rpc();

                    console.log("✅ Company token account created successfully");
                    console.log("🔹 Transaction:", tx);
                    console.log("🔹 Explorer URL:", `https://explorer.solana.com/tx/${tx}?cluster=devnet`);

                    // Verify company token account creation
                    console.log("\n🔍 Verifying company token account creation...");
                    const verifyAtaInfo = await connection.getAccountInfo(companyAta);
                    if (verifyAtaInfo) {
                        console.log("✅ Company token account verified!");
                        console.log("🔹 Account Size:", verifyAtaInfo.data.length);
                        console.log("🔹 Owner Program:", verifyAtaInfo.owner.toString());
                    } else {
                        throw ErrorFactory.tokenAccountNotFound(companyAta, companyWallet.publicKey);
                    }
                   
                } catch (error) {
                    throw ErrorFactory.transactionFailed("create company token account", error);
                }
            }
        }

        // 3. TOKEN METADATA
        if (operation === 'all' || operation === 'metadata' || operation === 'update') {
            console.log("\n📝 STEP 3: Managing Token Metadata");
            console.log("--------------------------------");

            const [metadataAccount] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("metadata"),
                    TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                    mintPda.toBuffer(),
                ],
                TOKEN_METADATA_PROGRAM_ID
            );
            console.log("🔹 Metadata Account address:", metadataAccount.toString());

            const metadataAccountInfo = await connection.getAccountInfo(metadataAccount);

            if (operation === 'update') {
                if (!metadataAccountInfo) {
                    console.log("❌ Metadata account doesn't exist! Please create it first.");
                    return;
                }

                try {
                    const token = await metaplex.nfts().findByMint({ mintAddress: mintPda });
                    const { response } = await metaplex.nfts().update({
                        nftOrSft: token,
                        name: tokenName,
                        symbol: tokenSymbol,
                        uri: tokenUri,
                    });

                    console.log("✅ Metadata updated successfully!");
                    console.log("🔹 Transaction:", response.signature);
                    console.log("🔹 Explorer URL:", `https://explorer.solana.com/tx/${response.signature}?cluster=devnet`);
                } catch (error) {
                    console.error("❌ Error updating metadata:", error);
                    return;
                }
            } else if (!metadataAccountInfo) {
                try {
                    console.log("❓ Metadata account does not exist, Creating metadata account");
                    const tx = await program.methods
                        .createTokenMetadata(
                            9,
                            tokenName,
                            tokenSymbol,
                            tokenUri
                        )
                        .accounts({
                            peerAuthority: companyWallet.publicKey,
                            peerMint: mintPda,
                            metadataAccount: metadataAccount,
                            tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
                            tokenProgram: TOKEN_2022_PROGRAM_ID,
                            systemProgram: SystemProgram.programId,
                            sysvarInstructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
                            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                        })
                        .signers([companyWallet])
                        .rpc();

                    console.log("✅ Token metadata created successfully");
                    console.log("🔹 Transaction:", tx);
                    console.log("🔹 Explorer URL:", `https://explorer.solana.com/tx/${tx}?cluster=devnet`);
                } catch (error) {
                    console.error("❌ Error creating metadata:", error);
                    return;
                }
            } else {
                console.log("✅ Metadata account already exists!");
                console.log("🔹 Metadata Account Size:", metadataAccountInfo.data.length);
                console.log("🔹 Metadata Account Owner:", metadataAccountInfo.owner.toString());
            }
        }

        console.log("\n📝 OPERATION SUMMARY");
        console.log("===================");
        console.log("1. Mint Account:", mintPda.toString());
        console.log("2. Company Token Account:", getAssociatedTokenAddressSync(
            mintPda,
            companyWallet.publicKey,
            false,
            TOKEN_2022_PROGRAM_ID
        ).toString());
        console.log("3. Metadata Account:", PublicKey.findProgramAddressSync(
            [Buffer.from("metadata"), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mintPda.toBuffer()],
            TOKEN_METADATA_PROGRAM_ID
        )[0].toString());

        console.log("\n📌 USAGE GUIDE");
        console.log("=============");
        console.log("- Create all accounts: ts-node Peer.ts all");
        console.log("- Create mint only: ts-node Peer.ts mint");
        console.log("- Create company account: ts-node Peer.ts company");
        console.log("- Create metadata: ts-node Peer.ts metadata");
        console.log("- Update metadata: ts-node Peer.ts update \"New Name\" \"NEW\" \"new-uri\"");

    } catch (error) {
        console.error("\n❌ ERROR DURING PEER TOKEN OPERATION:");
        const errorDetails = ErrorHandler.handle(error);
        console.error(`Error code: ${errorDetails.code}, Message: ${errorDetails.message}`);
        
        if (errorDetails.details) {
            console.error("Error details:", JSON.stringify(errorDetails.details, null, 2));
        }
        
        if (errorDetails.onChainCode) {
            console.error(`On-chain error code: ${errorDetails.onChainCode}`);
        }
        
        process.exit(1);
    }
}

main().then(() => console.log("\n✨ Done"));