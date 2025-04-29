import * as anchor from "@coral-xyz/anchor";
import { 
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getAccount,
  createAssociatedTokenAccountInstruction,
  getMint
} from "@solana/spl-token";
import { 
  PublicKey, 
  Keypair, 
  SystemProgram, 
  SYSVAR_RENT_PUBKEY,
  Connection,
  Transaction,
  sendAndConfirmTransaction
} from "@solana/web3.js";

import { readFileSync } from 'fs';
import * as path from 'path';
import { homedir } from 'os';

import * as idl from "../target/idl/peer_token.json";
import type { PeerToken } from "../target/types/peer_token";

const CONNECTION_URL = "https://api.devnet.solana.com";
const WALLET_PATH = "/Users/macbookpro/BlockChain/peer_rust_backend/peer-token/wallet-keypair.json";
const PROGRAM_ID = "3AhrXXfZ6QLe4bswBjkszDMb5RjnvhELNxESGRwK9jUk";
const MINT_ADDRESS = "FR9wWHQmyBJB4rnp3RGH4whpSSuGkVntENeKrNfnnxbX";

interface User {  
  walletAddress: string;
  tokenAmount: number;
}

interface Distribution {
  distributionId: string;
  users: User[];
}

interface ProcessedUser {
  wallet: PublicKey;
  tokenAmount: number;
}

interface UserDetail {
  wallet: string;
  tokenAccount: string;
  accountExists: boolean;
  currentBalance: string;
  tokenAmount: number;
}

interface TransferResult {
  wallet: string;
  tokenAmount: number;
  tokenAccount: string;
  accountCreated: boolean;
  finalBalance: string;
}

const dimitriInputExample: Distribution = {
  "distributionId": "token-distribution-2023-06-12",
  "users": [
    {
      "walletAddress": "FBbv5zeg6NpFmvq5tVbsi977ZnjsvGX2kgkW5BVAuX2b",
      "tokenAmount": 500
    },
    {
      "walletAddress": "9uph5xRg6DSGdMAVD1q6haSCF8HYV5vUN459ZctSz6yw",
      "tokenAmount": 300
    },
    {
      "walletAddress": "D8LGXiqA2P9vV4eJF4bLUSeYxPHYC6r94VozccSvPS6d",
      "tokenAmount": 200
    },
    {
      "walletAddress": "83vbytaC77sPKRHu5EuHFn2By6Kd73zyfcLvfS4GcUuL",
      "tokenAmount": 0
    }
  ]
};

const Logger = {
  header: (message: string) => {
    console.log("\n" + "=".repeat(80));
    console.log(`== ${message}`);
    console.log("=".repeat(80));
  },
  
  section: (message: string) => {
    console.log("\n" + "-".repeat(60));
    console.log(`| ${message}`);
    console.log("-".repeat(60));
  },
  
  detail: (label: string, value: string) => {
    console.log(`  ${label.padEnd(25)}: ${value}`);
  },
  
  error: (message: string, error: any) => {
    console.error(`ERROR: ${message}`);
    if (error) console.error("Error details:", error);
  }
};

// Load keypair from file
async function loadKeypairFromFile(filePath: string): Promise<Keypair> {
  try {
    const resolvedPath = path.resolve(
      filePath.startsWith("~") ? filePath.replace("~", homedir()) : filePath,
    );
    const loadedKeyBytes = Uint8Array.from(
      JSON.parse(readFileSync(resolvedPath, "utf8")),
    );
    return Keypair.fromSecretKey(loadedKeyBytes);
  } catch (error) {
    Logger.error(`Failed to load keypair from ${filePath}`, error);
    throw error;
  }
}

// Initialize connection and program
async function initializeProgram(companyKeypair: Keypair) {
  // Create a connection to Solana devnet
  const connection = new Connection(CONNECTION_URL, "confirmed");
  
  // Create provider
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(companyKeypair),
    { commitment: "confirmed" }
  );
  
  anchor.setProvider(provider);
  
  // Create program instance
  const programId = new PublicKey(PROGRAM_ID);
  const program = new anchor.Program(idl as unknown as PeerToken, programId, provider);
  
  return { connection, provider, program };
}

// Validate mint and company token account
async function setupTokenAccounts(connection: Connection, companyKeypair: Keypair) {
  const mint = new PublicKey(MINT_ADDRESS);
  const companyTokenAccount = getAssociatedTokenAddressSync(
    mint,
    companyKeypair.publicKey
  );
  
  // Check if mint exists
  try {
    const mintInfo = await getMint(connection, mint);
    Logger.detail("Mint Status", "✓ Exists");
    Logger.detail("Mint Authority", mintInfo.mintAuthority?.toString() || "None");
    Logger.detail("Mint Decimals", mintInfo.decimals.toString());
  } catch (error) {
    Logger.section("MINT CHECK FAILED");
    Logger.detail("Status", "✗ Token mint doesn't exist");
    Logger.detail("Required Action", "Use a valid mint address");
    throw error;
  }
  
  // Check if company token account exists
  const companyTokenAccountInfo = await connection.getAccountInfo(companyTokenAccount);
  
  if (!companyTokenAccountInfo) {
    Logger.section("COMPANY TOKEN ACCOUNT CHECK FAILED");
    Logger.detail("Status", "✗ Company token account doesn't exist");
    Logger.detail("Token Account Address", companyTokenAccount.toString());
    Logger.detail("Required Action", "Create the token account before running this script");
    throw new Error("Company token account does not exist");
  } else {
    Logger.detail("Company Token Account", "✓ Exists");
  }
  
  // Check current balance
  try {
    const tokenAccountInfo = await getAccount(connection, companyTokenAccount);
    const currentBalance = Number(tokenAccountInfo.amount);
    Logger.detail("Current Company Balance", currentBalance.toString());
    
    if (currentBalance === 0) {
      Logger.detail("Warning", "Company token account has 0 balance");
      Logger.detail("Action Needed", "Fund this account with tokens before distribution");
    }
    
    return { mint, companyTokenAccount, currentBalance };
  } catch (error) {
    Logger.detail("Current Balance Check", "Failed to get current balance");
    return { mint, companyTokenAccount, currentBalance: 0 };
  }
}

// Process and validate input
function processInput(distributionData: Distribution): {
  processedUsers: ProcessedUser[],
  distributionUsers: ProcessedUser[],
  totalTokens: number
} {
  // Map the data to our format
  const processedUsers = distributionData.users.map(user => ({
    wallet: new PublicKey(user.walletAddress),
    tokenAmount: user.tokenAmount
  }));
  
  // Include only users with tokenAmount > 0 in the actual distribution
  const distributionUsers = processedUsers.filter(user => user.tokenAmount > 0);
  const totalTokens = distributionData.users.reduce((sum, user) => sum + user.tokenAmount, 0);
  
  // Validate the data
  Logger.section("VALIDATING DATA");
  const totalTokensFromData = distributionUsers.reduce((sum, user) => sum + user.tokenAmount, 0);
  
  Logger.detail("Total Tokens Expected", totalTokens.toString());
  Logger.detail("Total Tokens from Data", totalTokensFromData.toString());
  
  if (totalTokensFromData !== totalTokens) {
    throw new Error("Total tokens don't match the sum of user tokens");
  }
  
  Logger.detail("Validation", "✓ Passed");
  
  return { processedUsers, distributionUsers, totalTokens };
}

// Check user token accounts
async function checkUserAccounts(
  connection: Connection,
  users: ProcessedUser[],
  mint: PublicKey
): Promise<UserDetail[]> {
  const userDetails: UserDetail[] = [];
  
  for (const user of users) {
    const userTokenAccount = getAssociatedTokenAddressSync(
      mint,
      user.wallet
    );
    
    // Check if token account exists
    let accountExists = false;
    let tokenBalance = "0";
    
    try {
      const accountInfo = await connection.getAccountInfo(userTokenAccount);
      accountExists = accountInfo !== null;
      
      if (accountExists) {
        const tokenAccountInfo = await getAccount(connection, userTokenAccount);
        tokenBalance = tokenAccountInfo.amount.toString();
      }
    } catch (error) {
      // Account likely doesn't exist
    }
    
    userDetails.push({
      wallet: user.wallet.toString(),
      tokenAccount: userTokenAccount.toString(),
      accountExists,
      currentBalance: tokenBalance,
      tokenAmount: user.tokenAmount
    });
  }
  
  // Log all user details
  userDetails.forEach((user, index) => {
    console.log(`\nUser ${index + 1}: ${user.wallet}`); 
    Logger.detail("Wallet Address", user.wallet);
    Logger.detail("Token Account Address", user.tokenAccount);
    Logger.detail("Token Account Exists", user.accountExists ? "Yes" : "No (will be created)");
    Logger.detail("Current Token Balance", user.currentBalance);
    Logger.detail("Tokens for Distribution", user.tokenAmount.toString());
  });
  
  return userDetails;
}

// Execute distributions
async function executeDistributions(
  program: anchor.Program<PeerToken>,
  connection: Connection,
  distributionUsers: ProcessedUser[],
  mint: PublicKey,
  companyTokenAccount: PublicKey,
  companyKeypair: Keypair
): Promise<TransferResult[]> {
  const successfulTransfers: TransferResult[] = [];
  
  for (const user of distributionUsers) {
    Logger.section(`PROCESSING USER: ${user.wallet}`);
    Logger.detail("Wallet", user.wallet.toString());
    Logger.detail("Tokens", user.tokenAmount.toString());
    
    // Derive user's token account 
    const userTokenAccount = getAssociatedTokenAddressSync(
      mint,
      user.wallet
    );
    
    // Check if account exists before transfer
    const accountExistsBefore = await connection.getAccountInfo(userTokenAccount) !== null;
    Logger.detail("Token Account", userTokenAccount.toString());
    Logger.detail("Account Exists Before", accountExistsBefore ? "Yes" : "No (will be created)");
    
    try {
      // If account doesn't exist, create it first
      if (!accountExistsBefore) {
        Logger.detail("Creating ATA", "Creating token account for recipient...");
        
        const createAtaIx = createAssociatedTokenAccountInstruction(
          companyKeypair.publicKey,  // payer
          userTokenAccount,          // associated token account address
          user.wallet,               // token account owner
          mint                       // token mint
        );
        
        const createAtaTx = new Transaction().add(createAtaIx);
        
        const createAtaSignature = await sendAndConfirmTransaction(
          connection,
          createAtaTx,
          [companyKeypair]
        );
        
        Logger.detail("ATA Creation", "✓ Token account created");
        Logger.detail("ATA Tx Signature", createAtaSignature);
        
        // Verify the account was created
        const accountCreated = await connection.getAccountInfo(userTokenAccount) !== null;
        if (!accountCreated) {
          throw new Error("Failed to create token account");
        }
      }
      
      // Now execute the transfer (token account is guaranteed to exist)
      const transferTx = await program.methods
        .transferTokens(new anchor.BN(user.tokenAmount))
        .accounts({
          mint: mint,
          sourceTokenAccount: companyTokenAccount,
          destinationTokenAccount: userTokenAccount,
          recipient: user.wallet,
          authority: companyKeypair.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
        
      // Get token balance after transfer
      let finalBalance = "Error fetching";
      try {
        const tokenAccountInfo = await getAccount(connection, userTokenAccount);
        finalBalance = tokenAccountInfo.amount.toString();
      } catch (error) {
        Logger.error("Failed to get final balance", error);
      }
      
      Logger.detail("Final Token Balance", finalBalance);
      Logger.detail("Transfer Status", "✓ Success");
      Logger.detail("Transaction Signature", transferTx);
      
      successfulTransfers.push({
        wallet: user.wallet.toString(),
        tokenAmount: user.tokenAmount,
        tokenAccount: userTokenAccount.toString(),
        accountCreated: !accountExistsBefore,
        finalBalance
      });
      
    } catch (error) {
      Logger.detail("Transfer Status", "✗ Failed");
      Logger.error(`Transfer failed for user ${user.wallet.toString()}`, error);
    }
  }
  
  return successfulTransfers;
}

// Generate a summary of transfers
function logTransferSummary(
  transferResults: TransferResult[],
  totalTokens: number,
  companyFinalBalance: string,
  initTx: string
): void {
  Logger.header("DISTRIBUTION SUMMARY");
  Logger.detail("Total Users Processed", transferResults.length.toString());
  Logger.detail("Successful Transfers", transferResults.length.toString());
  Logger.detail("Total Tokens Distributed", totalTokens.toString());
  Logger.detail("Company Final Balance", companyFinalBalance);
  Logger.detail("Initialization Transaction", initTx);
  
  // Log details of each transfer
  Logger.header("TRANSFER DETAILS");
  transferResults.forEach((result, index) => {
    Logger.section(`TRANSFER ${index + 1}`);
    Logger.detail("Wallet", result.wallet);
    Logger.detail("Tokens Transferred", result.tokenAmount.toString());
    Logger.detail("Token Account", result.tokenAccount);
    Logger.detail("Account Created", result.accountCreated ? "Yes" : "No");
    Logger.detail("Final Balance", result.finalBalance);
  });
}

// ==================== Main Function ====================
async function main() {
  try {
    // Load company keypair
    const companyKeypair = await loadKeypairFromFile(WALLET_PATH);
    
    Logger.header("COMPANY WALLET INFORMATION");
    Logger.detail("Company Wallet Address", companyKeypair.publicKey.toString());
    
    // Initialize connection and program
    const { connection, program } = await initializeProgram(companyKeypair);
    Logger.detail("Program ID", PROGRAM_ID);
    
    // Setup token accounts
    const { mint, companyTokenAccount, currentBalance } = await setupTokenAccounts(connection, companyKeypair);
    
    // Process input data
    Logger.header("PROCESSING INPUT FROM DIMITRI");
    console.log("Input data received:");
    console.log(JSON.stringify(dimitriInputExample, null, 2));
    
    const { processedUsers, distributionUsers, totalTokens } = processInput(dimitriInputExample);
    
    // Verify company has enough tokens for distribution
    if (currentBalance < totalTokens) {
      Logger.header("INSUFFICIENT FUNDS");
      Logger.detail("Current Balance", currentBalance.toString());
      Logger.detail("Required Balance", totalTokens.toString());
      Logger.detail("Shortfall", (totalTokens - currentBalance).toString());
      Logger.detail("Action Needed", "Please fund the company token account with more tokens");
      throw new Error("Insufficient tokens for distribution");
    }
    
    // Check user accounts
    Logger.section("USER WALLETS AND TOKEN ACCOUNTS");
    await checkUserAccounts(connection, processedUsers, mint);
    
    // Optional: Initialize the program (emits an event)
    Logger.header("INITIALIZING TOKEN TRANSFER");
    const initTx = await program.methods
      .initialize()
      .accounts({
        authority: companyKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    Logger.detail("Initialization Tx", initTx);
    
    // Execute token transfers
    Logger.header("EXECUTING TOKEN TRANSFERS");
    const successfulTransfers = await executeDistributions(
      program,
      connection,
      distributionUsers,
      mint,
      companyTokenAccount,
      companyKeypair
    );
    
    // Get company final balance
    let companyFinalBalance = "Error fetching balance";
    try {
      const finalCompanyInfo = await getAccount(connection, companyTokenAccount);
      companyFinalBalance = finalCompanyInfo.amount.toString();
    } catch (error) {
      Logger.error("Failed to fetch company final balance", error);
    }
    
    // Log transfer summary
    logTransferSummary(
      successfulTransfers,
      totalTokens,
      companyFinalBalance,
      initTx
    );
    
  } catch (error) {
    Logger.header("ERROR DURING DISTRIBUTION");
    Logger.error("Distribution process failed", error);
  }
}

// Run the main function
main();