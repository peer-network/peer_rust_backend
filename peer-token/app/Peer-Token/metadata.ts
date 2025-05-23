import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Connection, Keypair, SystemProgram, clusterApiUrl } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { Metaplex, keypairIdentity } from "@metaplex-foundation/js";
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { ErrorHandler } from "../errors";

dotenv.config();

// Set up the program ID
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID!);

// Metaplex Token Metadata Program ID
const TOKEN_METADATA_PROGRAM_ID = new PublicKey(process.env.TOKEN_METADATA_PROGRAM_ID!);

async function main() {
    try {
        // Get command line arguments
        const operation = process.argv[2] || 'create';
        const tokenName = process.argv[3] || "Peer Token Beta";
        const tokenSymbol = process.argv[4] || "PEER";
        const tokenUri = process.argv[5] || "https://raw.githubusercontent.com/utkuurkun/peer-token-metadata/refs/heads/main/token.json";

        console.log("\n🚀 Starting token metadata operation...");
        console.log("Operation:", operation);
        
        // Set up connection
        const connection = new Connection(process.env.RPC_ENDPOINT || clusterApiUrl("devnet"), "confirmed");
        
        // Load wallet keypair
        const keypair = Keypair.fromSecretKey(
            Buffer.from(JSON.parse(fs.readFileSync(process.env.COMPANY_WALLET_PATH!, "utf-8")))
        );
        console.log("\n💳 Using wallet:", keypair.publicKey.toString());

        // Set up Metaplex for updates
        const metaplex = Metaplex.make(connection)
            .use(keypairIdentity(keypair));
            

        // Create Anchor provider for initial creation
        const provider = new anchor.AnchorProvider(
            connection,
            new anchor.Wallet(keypair),
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
            PROGRAM_ID
        );
        console.log("🔹 Mint PDA:", mintPda.toString());

        // Check if mint exists
        console.log("\n🔍 Checking if mint account exists...");
        const mintAccountInfo = await connection.getAccountInfo(mintPda);
        
        if (!mintAccountInfo) {
            console.log("❌ Mint account does not exist!");
            console.log("Please run Mint_token.ts first to create the mint account.");
            return;
        }

        // Derive the metadata account PDA
        const [metadataAccount] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("metadata"),
                TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                mintPda.toBuffer(),
            ],
            TOKEN_METADATA_PROGRAM_ID
        );
        console.log("🔹 Metadata Account:", metadataAccount.toString());

        // Check if metadata exists
        console.log("\n🔍 Checking if metadata account exists...");
        const metadataAccountInfo = await connection.getAccountInfo(metadataAccount);

        if (operation === 'update') {
            if (!metadataAccountInfo) {
                console.log("❌ Metadata account doesn't exist! Please create it first.");
                console.log("Run: ts-node metadata.ts create");
                return;
            }

            console.log("⏳ Updating token metadata...");
            console.log("New Name:", tokenName);
            console.log("New Symbol:", tokenSymbol);
            console.log("New URI:", tokenUri);

            try {

                const token = await metaplex.nfts().findByMint({ mintAddress: mintPda });
                // Update using Metaplex JS SDK
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
                console.error("❌ Error updating metadata:");
                ErrorHandler.handle(error);
            }
        } else {
            if (metadataAccountInfo) {
                console.log("✅ Metadata account already exists!");
                console.log("🔹 Metadata Account Size:", metadataAccountInfo.data.length);
                console.log("🔹 Metadata Account Owner:", metadataAccountInfo.owner.toString());
                console.log("\nTo update metadata, run:");
                console.log("ts-node metadata.ts update \"New Name\" \"NEW\" \"new-uri\"");
                return;
            }

            console.log("⏳ Creating token metadata...");

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
                console.error("❌ Error creating metadata:");
                ErrorHandler.handle(error);
            }
        }

        console.log("\n📝 IMPORTANT NOTES:");
        console.log("1. Token metadata is stored on-chain using Metaplex standard");
        console.log("2. The metadata account is a PDA derived from the mint");
        console.log("3. Token metadata includes name, symbol, and URI");
        console.log("4. The URI should point to a JSON file with additional metadata");
        console.log("5. Only the update authority can modify the metadata");

    } catch (error) {
        console.error("\n❌ ERROR:");
        ErrorHandler.handle(error);
    }
}

main().then(() => console.log("\n✨ Done"));