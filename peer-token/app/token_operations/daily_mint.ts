import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet, BN } from '@coral-xyz/anchor';
import { IDL } from '../../target/types/peer_token';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import fs from 'fs';

// Program ID from declare_id!() in lib.rs
const PROGRAM_ID = new PublicKey('DAApXWPZsSdDUPRhmSgQTuwKqT8ooR9oboGz9wLK69n9');

// File to store last mint timestamp
const LAST_MINT_FILE = 'last_mint.json';

interface LastMintData {
    lastMintTimestamp: number;
}

async function loadLastMint(): Promise<LastMintData | null> {
    try {
        const data = fs.readFileSync(LAST_MINT_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        return null;
    }
}

async function saveLastMint(timestamp: number): Promise<void> {
    const data: LastMintData = { lastMintTimestamp: timestamp };
    fs.writeFileSync(LAST_MINT_FILE, JSON.stringify(data));
}

async function canMintToday(): Promise<boolean> {
    const lastMint = await loadLastMint();
    if (!lastMint) return true;

    const lastMintDate = new Date(lastMint.lastMintTimestamp * 1000);
    const currentDate = new Date();

    // Check if it's a new day
    return lastMintDate.getDate() !== currentDate.getDate() ||
           lastMintDate.getMonth() !== currentDate.getMonth() ||
           lastMintDate.getFullYear() !== currentDate.getFullYear();
}

async function main() {
    // Connect to Solana devnet
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    
    // Load company wallet from file
    const companyKeypair = Keypair.fromSecretKey(
        Buffer.from(JSON.parse(fs.readFileSync('/Users/macbookpro/Solana/keys/wallet.json', 'utf-8')))
    );
    
    // Create provider with company wallet
    const provider = new AnchorProvider(
        connection,
        new Wallet(companyKeypair),
        { commitment: 'confirmed' }
    );
    
    // Create program interface
    const program = new Program(IDL, PROGRAM_ID, provider);
    
    try {
        // Check if we can mint today
        if (!await canMintToday()) {
            console.log('Tokens have already been minted today. Try again tomorrow.');
            return;
        }

        // Get token mint PDA
        const [mintPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('peer-token')],
            program.programId
        );

        const [lastMintPDA] = PublicKey.findProgramAddressSync(
            [
                Buffer.from('daily-mint'),
                companyKeypair.publicKey.toBuffer()
            ],
            program.programId
        );
        
        // Get peer token account (ATA)
        const peerTokenAccount = getAssociatedTokenAddressSync(
            mintPDA,
            companyKeypair.publicKey
        );
        
        console.log('Peer Token Account:', peerTokenAccount.toString());
        
        // Daily mint amount (e.g. 1000 tokens)
        const amount = new BN(1000);
        
        // Execute daily mint instruction
        const tx = await program.methods
            .dailyMint(amount)
            .accounts({
                peerAuthority: companyKeypair.publicKey,
                peerMint: mintPDA,
                peerTokenAccount: peerTokenAccount,
                tokenProgram: program.programId,
                lastMint: lastMintPDA,
            })
            .signers([companyKeypair])
            .rpc();
            
        // Save the current timestamp
        await saveLastMint(Math.floor(Date.now() / 1000));
            
        console.log('Daily mint successful!');
        console.log('Transaction:', tx);
        console.log('View transaction: https://explorer.solana.com/tx/' + tx + '?cluster=devnet');
        
    } catch (error) {
        console.error('Error:', error);
        // Log full error stack
        if (error instanceof Error) {
            console.error(error.stack);
        }
    }
}

main(); 