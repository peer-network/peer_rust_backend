import * as fs from 'fs';
import * as path from 'path';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { 
    TOKEN_2022_PROGRAM_ID, 
    getAssociatedTokenAddressSync, 
    TokenAccountNotFoundError,
    Account,
    unpackAccount,
    getAccount
} from '@solana/spl-token';

// Configuration
const CLUSTER = 'devnet'; // Change to 'mainnet-beta' for production
const MINT_ADDRESS = "FSZ2Mv7GeB1Px7qQP2xJs6NVcA8t7kSY4c1gpRqrfBnP"; // Replace with your token's mint address
const DATA_FILE_PATH = path.join(__dirname, '../data/data.json');
const TOKEN_DECIMALS = 9; // Use the correct number of decimals for your token

// Type definition for data.json structure
interface WalletData {
    wallets: {
        address: string;
        [key: string]: any;  // Allow for any other fields in the wallet data
    }[];
}

/**
 * Checks if a wallet has an Associated Token Account for the specified mint
 */
async function validateATA(connection: Connection, walletAddress: string, mintAddress: string): Promise<{
    walletAddress: string;
    hasATA: boolean;
    ataAddress?: string;
    ataBalance?: number;
    error?: string;
}> {
    try {
        const walletPubkey = new PublicKey(walletAddress);
        const mintPubkey = new PublicKey(mintAddress);

        // Calculate what the ATA address should be
        const ataAddress = getAssociatedTokenAddressSync(
            mintPubkey,
            walletPubkey,
            false,  // allowOwnerOffCurve
            TOKEN_2022_PROGRAM_ID  // Use TOKEN_2022_PROGRAM_ID for Token-2022 tokens
        );

        // Check if the ATA exists
        try {
            const accountInfo = await connection.getAccountInfo(ataAddress);
            
            if (!accountInfo) {
                return {
                    walletAddress,
                    hasATA: false,
                    ataAddress: ataAddress.toString(),
                    error: "ATA does not exist"
                };
            }

            // Validate that this is actually a token account for the correct mint
            try {
                const tokenAccount = await getAccount(
                    connection,
                    ataAddress,
                    connection.commitment,
                    TOKEN_2022_PROGRAM_ID
                );

                const isCorrectMint = tokenAccount.mint.equals(mintPubkey);
                const isOwnedByWallet = tokenAccount.owner.equals(walletPubkey);
                const balance = Number(tokenAccount.amount) / Math.pow(10, TOKEN_DECIMALS);

                return {
                    walletAddress,
                    hasATA: isCorrectMint && isOwnedByWallet,
                    ataAddress: ataAddress.toString(),
                    ataBalance: balance,
                    error: isCorrectMint && isOwnedByWallet ? undefined : "Account exists but isn't a valid ATA"
                };
            } catch (error) {
                return {
                    walletAddress,
                    hasATA: false,
                    ataAddress: ataAddress.toString(),
                    error: "Error validating token account: " + (error as Error).message
                };
            }
        } catch (error) {
            return {
                walletAddress,
                hasATA: false,
                ataAddress: ataAddress.toString(),
                error: "Error fetching ATA: " + (error as Error).message
            };
        }
    } catch (error) {
        return {
            walletAddress,
            hasATA: false,
            error: "Invalid address format: " + (error as Error).message
        };
    }
}

/**
 * Main function to validate all wallets
 */
async function main() {
    try {
        // Initialize connection to Solana
        const connection = new Connection(clusterApiUrl(CLUSTER), 'confirmed');
        
        // Load the wallet data
        if (!fs.existsSync(DATA_FILE_PATH)) {
            console.error(`❌ Error: Data file not found at ${DATA_FILE_PATH}`);
            return;
        }
        
        // Read and parse the data file
        const rawData = fs.readFileSync(DATA_FILE_PATH, 'utf8');
        const data: WalletData = JSON.parse(rawData);
        
        if (!Array.isArray(data.wallets)) {
            console.error('❌ Error: Invalid data format. Expected "wallets" array.');
            return;
        }
        
        console.log(`🔍 Validating ATAs for ${data.wallets.length} wallets on ${CLUSTER}...`);
        console.log(`🔹 Token mint: ${MINT_ADDRESS}`);
        console.log(`🔹 Token decimals: ${TOKEN_DECIMALS}`);
        
        // Process each wallet
        const results = [];
        for (const wallet of data.wallets) {
            if (!wallet.address) {
                console.warn('⚠️ Warning: Wallet missing address field, skipping.');
                continue;
            }
            
            console.log(`\n🔹 Checking wallet: ${wallet.address}`);
            const result = await validateATA(connection, wallet.address, MINT_ADDRESS);
            results.push(result);
            
            if (result.hasATA) {
                console.log(`✅ Valid ATA found: ${result.ataAddress}`);
                console.log(`   Balance: ${result.ataBalance} tokens`);
            } else {
                console.log(`❌ No valid ATA: ${result.error}`);
                if (result.ataAddress) {
                    console.log(`   Expected ATA: ${result.ataAddress}`);
                }
            }
        }
        
        // Generate summary report
        console.log('\n====== SUMMARY REPORT ======');
        console.log(`Total wallets checked: ${results.length}`);
        console.log(`Valid ATAs found: ${results.filter(r => r.hasATA).length}`);
        console.log(`Missing ATAs: ${results.filter(r => !r.hasATA).length}`);
        
        // Output results to a file
        const outputPath = path.join(__dirname, '../data/validation-results.json');
        fs.writeFileSync(outputPath, JSON.stringify({
            timestamp: new Date().toISOString(),
            mintAddress: MINT_ADDRESS,
            cluster: CLUSTER,
            results
        }, null, 2));
        
        console.log(`\n✅ Results saved to: ${outputPath}`);
        
    } catch (error) {
        console.error('❌ Error during validation:', error);
    }
}

// Execute the main function
main().then(() => console.log('\nValidation complete.')); 