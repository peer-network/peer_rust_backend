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
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddressSync
} from "@solana/spl-token";
import { Metaplex, keypairIdentity } from "@metaplex-foundation/js";
import * as fs from 'fs';
import * as path from 'path';

// Program and Token Constants
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID!)
const TOKEN_METADATA_PROGRAM_ID = new PublicKey(process.env.TOKEN_METADATA_PROGRAM_ID!);

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
        
        // Set up connection
        const connection = new Connection(process.env.RPC_ENDPOINT || clusterApiUrl("devnet"), "confirmed");
        
        // Load wallet keypair
        const keypair = Keypair.fromSecretKey(
            Buffer.from(JSON.parse(fs.readFileSync(process.env.COMPANY_WALLET_PATH!, "utf-8")))
        );
        console.log("\n💳 Using Company wallet:", keypair.publicKey.toString());

        // Setup providers and programs
        const provider = new anchor.AnchorProvider(
            connection,
            new anchor.Wallet(keypair),
            { commitment: "confirmed" }
        );
        anchor.setProvider(provider);

        const idlPath = path.join(process.cwd(), "target", "idl", "peer_token.json");
        const idlFile = fs.readFileSync(idlPath, 'utf8');
        const idl = JSON.parse(idlFile);
        const program = new anchor.Program(idl, PROGRAM_ID, provider);

        // Derive PDAs
        const [mintPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("peer-token")],
            PROGRAM_ID
        );
        console.log("\n🔑 PDAs and Accounts");
        console.log("-------------------");
        console.log("Mint PDA:", mintPda.toString());

        // Setup Metaplex
        const metaplex = Metaplex.make(connection)
            .use(keypairIdentity(keypair));

        // 1. MINT TOKEN
        if (operation === 'all' || operation === 'mint') {
            console.log("\n📝 STEP 1: Creating Token Mint");
            console.log("----------------------------");

            const mintAccountInfo = await connection.getAccountInfo(mintPda);
            
            if (mintAccountInfo) {
                console.log("✅ Mint account already exists!");
                console.log("🔹 Account Size:", mintAccountInfo.data.length);
                console.log("🔹 Owner:", mintAccountInfo.owner.toString());
            } else {
                try {
                    const tx = await program.methods
                        .createToken()
                        .accounts({
                            peerAuthority: keypair.publicKey,
                            peerMint: mintPda,
                            systemProgram: SystemProgram.programId,
                            tokenProgram: TOKEN_2022_PROGRAM_ID,
                            rent: anchor.web3.SYSVAR_RENT_PUBKEY
                        })
                        .signers([keypair])
                        .rpc();

                    console.log("✅ Token mint created successfully");
                    console.log("🔹 Transaction:", tx);
                    console.log("🔹 Explorer URL:", `https://explorer.solana.com/tx/${tx}?cluster=devnet`);
                } catch (error) {
                    console.error("❌ Error creating mint:", error);
                    return;
                }
            }
        }

        // 2. COMPANY TOKEN ACCOUNT
        if (operation === 'all' || operation === 'company') {
            console.log("\n📝 STEP 2: Creating Company Token Account");
            console.log("-------------------------------------");

            const companyAta = getAssociatedTokenAddressSync(
                mintPda,
                keypair.publicKey,
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
                    const tx = await program.methods
                        .createAssociatedTokenAccount()
                        .accounts({
                            signer: keypair.publicKey,
                            peerMint: mintPda,
                            peerTokenAccount: companyAta,
                            systemProgram: SystemProgram.programId,
                            tokenProgram: TOKEN_2022_PROGRAM_ID,
                            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
                        })
                        .signers([keypair])
                        .rpc();

                    console.log("✅ Company token account created successfully");
                    console.log("🔹 Transaction:", tx);
                    console.log("🔹 Explorer URL:", `https://explorer.solana.com/tx/${tx}?cluster=devnet`);
                } catch (error) {
                    console.error("❌ Error creating company token account:", error);
                    return;
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
            console.log("🔹 Metadata Account:", metadataAccount.toString());

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
                    const tx = await program.methods
                        .createTokenMetadata(
                            9,
                            tokenName,
                            tokenSymbol,
                            tokenUri
                        )
                        .accounts({
                            peerAuthority: keypair.publicKey,
                            peerMint: mintPda,
                            metadataAccount: metadataAccount,
                            tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
                            tokenProgram: TOKEN_2022_PROGRAM_ID,
                            systemProgram: SystemProgram.programId,
                            sysvarInstructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
                            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                        })
                        .signers([keypair])
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
            keypair.publicKey,
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
        console.error("\n❌ FATAL ERROR:", error);
        if (error instanceof Error) {
            console.error("Error message:", error.message);
            console.error("Error stack:", error.stack);
        }
    }
}

main().then(() => console.log("\n✨ Done"));