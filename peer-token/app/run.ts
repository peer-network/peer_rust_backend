import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Connection, Keypair, SystemProgram, clusterApiUrl } from "@solana/web3.js";
import * as fs from 'fs';
import { TOKEN_2022_PROGRAM_ID, getMint } from "@solana/spl-token";
import * as path from 'path';

// Set up the environment
const PROGRAM_ID = new PublicKey("7tUBeYarZfa7mkhZeNoEanWyuUaZhStmbk89rXKj4ck9");

async function main() {
    try {
        console.log("Starting token mint process...");
        
        // Set up connection and wallet
        const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
        console.log("Connected to Solana devnet");
        
        const keypair = Keypair.fromSecretKey(
            Buffer.from(JSON.parse(fs.readFileSync("/Users/macbookpro/Solana/keys/wallet.json", "utf-8")))
        );
        console.log("Loaded wallet:", keypair.publicKey.toString());

        // Create provider
        const provider = new anchor.AnchorProvider(
            connection,
            new anchor.Wallet(keypair),
            { commitment: "confirmed" }
        );
        anchor.setProvider(provider);
        console.log("Provider set up completed");

        // Load the IDL from the local file
        const idlPath = path.join(process.cwd(), "target", "idl", "peer_token.json");
        console.log("Loading IDL from:", idlPath);
        const idlFile = fs.readFileSync(idlPath, 'utf8');
        const idl = JSON.parse(idlFile);
        console.log("IDL loaded successfully");

        // Force the program ID to match
        if (idl.metadata) {
            idl.metadata.address = PROGRAM_ID.toString();
        } else {
            idl.metadata = { address: PROGRAM_ID.toString() };
        }
        console.log("IDL metadata updated with program ID");

        // Create program interface
        const program = new anchor.Program(idl, PROGRAM_ID, provider);
        console.log("Program interface created");

        // Find the PDA for mint (using the same seeds as in your on-chain program)
        // Make sure these match EXACTLY with your on-chain program's PDA derivation
        const [mintPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("Pse")],
            PROGRAM_ID
        );

        console.log("\n=== Program Details ===");
        console.log("Program ID:", PROGRAM_ID.toString());
        console.log("Mint PDA:", mintPda.toString());
        console.log("Authority:", keypair.publicKey.toString());

        // Check if mint account already exists
        console.log("\nChecking if mint account already exists...");
        const mintAccountInfo = await connection.getAccountInfo(mintPda);
        
        if (mintAccountInfo) {
            console.log("Mint account already exists!");
            console.log("Mint Account Size:", mintAccountInfo.data.length);
            console.log("Mint Account Owner:", mintAccountInfo.owner.toString());
            
            try {
                // Try to get token mint info if possible
                const mintInfo = await getMint(
                    connection,
                    mintPda,
                    "confirmed",
                    TOKEN_2022_PROGRAM_ID
                );
                console.log("Token Supply:", mintInfo.supply.toString());
                console.log("Decimals:", mintInfo.decimals);
                console.log("Mint Authority:", mintInfo.mintAuthority?.toString() || "None");
            } catch (error) {
                console.log("Could not fetch detailed mint info:", error.message);
            }
            
            console.log("Skipping mint creation as it already exists");
            return;
        }

        // Create mint transaction
        console.log("\nCreating mint...");
        const tx = await program.methods
            .createMint(
                "PEER Token",
                "PEER",
                "https://media.peer-network.eu/image/PeerSignet_Color_RGB.png",
                9,
                new anchor.BN(1000000000)
            )
            .accounts({
                mint: mintPda,  // This is required by your program
                authority: keypair.publicKey,
                tokenProgram2022: TOKEN_2022_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY
            })
            .signers([keypair])
            .rpc();

        console.log("\n=== Transaction Details ===");
        console.log("Transaction Signature:", tx);
        console.log("Explorer URL:", `https://explorer.solana.com/tx/${tx}?cluster=devnet`);

        // Verify the mint was created
        console.log("\nVerifying mint creation...");
        const mintInfo = await connection.getAccountInfo(mintPda);
        console.log("\n=== Mint Verification ===");
        console.log("Mint Account Exists:", mintInfo !== null);
        if (mintInfo) {
            console.log("Mint Account Size:", mintInfo.data.length);
            console.log("Mint Account Owner:", mintInfo.owner.toString());
            
            try {
                // Try to get token mint info
                const tokenMintInfo = await getMint(
                    connection,
                    mintPda,
                    "confirmed",
                    TOKEN_2022_PROGRAM_ID
                );
                console.log("Token Supply:", tokenMintInfo.supply.toString());
                console.log("Decimals:", tokenMintInfo.decimals);
            } catch (error) {
                console.log("Could not fetch detailed mint info:", error.message);
            }
        }
    } catch (error) {
        console.error("\n=== ERROR ===");
        console.error("Error:", error);
        if (error instanceof Error) {
            console.error("Error message:", error.message);
            console.error("Error stack:", error.stack);
        }
    }
}

main().then(() => console.log("\nDone"));