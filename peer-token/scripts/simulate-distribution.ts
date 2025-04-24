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

import { readFileSync, writeFileSync } from 'fs';
import * as path from 'path';
import { homedir } from 'os';

import * as idl from "../target/idl/peer_token.json";
import type { PeerToken } from "../target/types/peer_token";

// Function to load keypair from file
async function loadKeypairFromFile(filePath: string): Promise<Keypair> {
  const resolvedPath = path.resolve(
    filePath.startsWith("~") ? filePath.replace("~", homedir()) : filePath,
  );
  const loadedKeyBytes = Uint8Array.from(
    JSON.parse(readFileSync(resolvedPath, "utf8")),
  );
  return Keypair.fromSecretKey(loadedKeyBytes);
}

// Example JSON data from Dimitri (this would normally come from an API/file)
const dimitriInputExample = {
  "distributionId": "gems-distribution-2023-06-12",
  "totalGems": 100,
  "users": [
    {
      "userId": "user123",
      "walletAddress": "FBbv5zeg6NpFmvq5tVbsi977ZnjsvGX2kgkW5BVAuX2b", // Real Solana wallet
      "gems": 50
    },
    {
      "userId": "user456", 
      "walletAddress": "9uph5xRg6DSGdMAVD1q6haSCF8HYV5vUN459ZctSz6yw", // Real Solana wallet
      "gems": 30
    },
    {
      "userId": "user789",
      "walletAddress": "D8LGXiqA2P9vV4eJF4bLUSeYxPHYC6r94VozccSvPS6d", // Real Solana wallet
      "gems": 20
    },
    // Example of a new wallet we're adding to test ATA creation
    {
      "userId": "userNew",
      "walletAddress": "83vbytaC77sPKRHu5EuHFn2By6Kd73zyfcLvfS4GcUuL", // Real Solana wallet
      "gems": 0
    }
  ]
};

// Pretty log formatting
function logHeader(message: string) {
  console.log("\n" + "=".repeat(80));
  console.log(`== ${message}`);
  console.log("=".repeat(80));
}

function logSection(message: string) {
  console.log("\n" + "-".repeat(60));
  console.log(`| ${message}`);
  console.log("-".repeat(60));
}

function logDetail(label: string, value: string) {
  console.log(`  ${label.padEnd(25)}: ${value}`);
}

// This script simulates Dimitri's client-side interaction with your program
async function main() {
  // Create a connection to Solana devnet
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  
  // Load company keypair from file
  const companyKeypair = await loadKeypairFromFile("/Users/macbookpro/BlockChain/peer_rust_backend/peer-token/wallet-keypair.json");
  
  logHeader("COMPANY WALLET INFORMATION");
  logDetail("Company Wallet Address", companyKeypair.publicKey.toString());
  
  // Create provider manually instead of using env()
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(companyKeypair),
    { commitment: "confirmed" }
  );
  
  anchor.setProvider(provider);
  
  // Create program instance
  const programId = new PublicKey("AyU7HfAP36feEsNTfAifzLxDcT7kCYPER6HxWeb7czmX");
  const program = new anchor.Program(idl as unknown as PeerToken, programId, provider);
  
  logDetail("Program ID", programId.toString());
  
  // Set up the mint (normally created by Sushank's program)
  const MINT_ADDRESS = "C3rzZ2ToAG9P2bBHEqTXK3Gk85g5VJMuU7rKPHahQq61"; // Replace with actual mint
  let mint = new PublicKey(MINT_ADDRESS);
  
  // Get the company's token account for this mint
  let companyTokenAccount = getAssociatedTokenAddressSync(
    mint,
    companyKeypair.publicKey
  );
  
  // Log mint and company token account info
  logDetail("Token Mint Address", mint.toString());
  logDetail("Company Token Account", companyTokenAccount.toString());
  
  // Check if mint exists
  try {
    const mintInfo = await getMint(connection, mint);
    logDetail("Mint Status", "✓ Exists");
    logDetail("Mint Authority", mintInfo.mintAuthority?.toString() || "None");
    logDetail("Mint Decimals", mintInfo.decimals.toString());
  } catch (error) {
    // Mint doesn't exist
    logSection("MINT CHECK FAILED");
    logDetail("Status", "✗ Token mint doesn't exist");
    logDetail("Required Action", "Use the mint address provided by Sushank");
    console.error("Error details:", error);
    return;
  }
  
  // Check if company token account exists and create it if not
  const companyTokenAccountInfo = await connection.getAccountInfo(companyTokenAccount);
  
  if (!companyTokenAccountInfo) {
    logSection("CREATING COMPANY TOKEN ACCOUNT");
    logDetail("Status", "Creating Associated Token Account for company wallet");
    
    // Create the ATA for company wallet
    const transaction = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        companyKeypair.publicKey, // payer
        companyTokenAccount,      // ata
        companyKeypair.publicKey, // owner
        mint                      // mint
      )
    );
    
    try {
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [companyKeypair]
      );
      logDetail("Transaction Signature", signature);
      logDetail("Status", "✓ Company Token Account created successfully");
    } catch (error) {
      logDetail("Status", "✗ Failed to create Company Token Account");
      console.error("Error details:", error);
      return;
    }
  } else {
    logDetail("Company Token Account", "Already exists");
  }
  
  // Check current balance
  try {
    const tokenAccountInfo = await getAccount(connection, companyTokenAccount);
    const currentBalance = Number(tokenAccountInfo.amount);
    logDetail("Current Company Balance", currentBalance.toString());
    
    if (currentBalance === 0) {
      logDetail("Warning", "Company token account has 0 balance");
      logDetail("Action Needed", "Fund this account with tokens before distribution");
    }
  } catch (error) {
    logDetail("Current Balance Check", "Failed to get current balance");
  }
  
  // Process Dimitri's input
  logHeader("PROCESSING INPUT FROM DIMITRI");
  console.log("Input data received:");
  console.log(JSON.stringify(dimitriInputExample, null, 2));
  
  // Map Dimitri's data to our format
  const users = dimitriInputExample.users.map(user => ({
    userId: user.userId,
    wallet: new PublicKey(user.walletAddress),
    gems: user.gems
  }));
  
  // Include only users with gems > 0 in the actual distribution
  const distributionUsers = users.filter(user => user.gems > 0);
  const totalGems = dimitriInputExample.totalGems;
  
  // Validate the data
  logSection("VALIDATING DATA");
  const totalGemsFromData = distributionUsers.reduce((sum, user) => sum + user.gems, 0);
  
  logDetail("Total Gems Expected", totalGems.toString());
  logDetail("Total Gems from Data", totalGemsFromData.toString());
  
  if (totalGemsFromData !== totalGems) {
    console.error("ERROR: Total gems don't match the sum of user gems");
    return;
  }
  
  logDetail("Validation", "✓ Passed");
  
  // Log all user wallets and their ATA information
  logSection("USER WALLETS AND TOKEN ACCOUNTS");
  
  // Create array to store all user data for logging
  const userDetails = [];
  
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
      userId: user.userId,
      wallet: user.wallet.toString(),
      tokenAccount: userTokenAccount.toString(),
      accountExists: accountExists,
      currentBalance: tokenBalance,
      gems: user.gems
    });
  }
  
  // Log all user details
  userDetails.forEach((user, index) => {
    console.log(`\nUser ${index + 1}: ${user.userId}`);
    logDetail("Wallet Address", user.wallet);
    logDetail("Token Account Address", user.tokenAccount);
    logDetail("Token Account Exists", user.accountExists ? "Yes" : "No (will be created)");
    logDetail("Current Token Balance", user.currentBalance);
    logDetail("Gems for Distribution", user.gems.toString());
  });
  
  // Initialize the distribution
  logHeader("INITIALIZING DISTRIBUTION");
  
  // Create a distribution account
  const distributionInfo = Keypair.generate();
  logDetail("Distribution Account", distributionInfo.publicKey.toString());
  
  // Format recipients for the program
  const recipients = distributionUsers.map(user => ({
    wallet: user.wallet,
    gems: new anchor.BN(user.gems)
  }));

  try {
    // Initialize distribution
    logSection("CREATING DISTRIBUTION");
    const distributeTx = await program.methods
      .distributeTokens(recipients, new anchor.BN(totalGems))
      .accounts({
        mint: mint,
        sourceTokenAccount: companyTokenAccount,
        authority: companyKeypair.publicKey,
        distributionInfo: distributionInfo.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([distributionInfo])
      .rpc();
      
    logDetail("Status", "✓ Success");
    logDetail("Transaction Signature", distributeTx);
    
    // Execute transfers for each user with gems
    logHeader("EXECUTING DISTRIBUTIONS");
    
    // Track users who received tokens
    const successfulTransfers = [];
    
    for (const user of distributionUsers) {
      logSection(`PROCESSING USER: ${user.userId}`);
      logDetail("Wallet", user.wallet.toString());
      logDetail("Gems", user.gems.toString());
      
      // Derive user's token account 
      const userTokenAccount = getAssociatedTokenAddressSync(
        mint,
        user.wallet
      );
      
      // Check if account exists before transfer
      const accountExistsBefore = await connection.getAccountInfo(userTokenAccount) !== null;
      logDetail("Token Account", userTokenAccount.toString());
      logDetail("Account Exists Before", accountExistsBefore ? "Yes" : "No (will be created)");
      
      try {
        // Execute the distribution
        const executeTx = await program.methods
          .executeDistribution(new anchor.BN(user.gems))
          .accounts({
            mint: mint,
            sourceTokenAccount: companyTokenAccount,
            destinationTokenAccount: userTokenAccount,
            recipient: user.wallet,
            authority: companyKeypair.publicKey,
            distributionInfo: distributionInfo.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .rpc();
          
        // Check if account exists after transfer
        const accountExistsAfter = await connection.getAccountInfo(userTokenAccount) !== null;
        logDetail("Account Exists After", accountExistsAfter ? "Yes" : "Yes (created during transfer)");
        
        // Get token balance
        let finalBalance = "Error fetching";
        try {
          const tokenAccountInfo = await getAccount(connection, userTokenAccount);
          finalBalance = tokenAccountInfo.amount.toString();
        } catch (error) {
          // Handle error
        }
        
        logDetail("Final Token Balance", finalBalance);
        logDetail("Transfer Status", "✓ Success");
        logDetail("Transaction Signature", executeTx);
        
        successfulTransfers.push({
          userId: user.userId,
          wallet: user.wallet.toString(),
          gems: user.gems,
          tokenAccount: userTokenAccount.toString(),
          accountCreated: !accountExistsBefore && accountExistsAfter,
          finalBalance
        });
        
      } catch (error) {
        logDetail("Transfer Status", "✗ Failed");
        console.error(`Error details:`, error);
      }
    }
    
    // Finalize the distribution
    logHeader("FINALIZING DISTRIBUTION");
    
    const finalizeTx = await program.methods
      .finalizeDistribution()
      .accounts({
        authority: companyKeypair.publicKey,
        distributionInfo: distributionInfo.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
      
    logDetail("Status", "✓ Success");
    logDetail("Transaction Signature", finalizeTx);
    
    // Final summary
    logHeader("DISTRIBUTION SUMMARY");
    logDetail("Total Users Processed", distributionUsers.length.toString());
    logDetail("Successful Transfers", successfulTransfers.length.toString());
    logDetail("Total Gems Distributed", totalGems.toString());
    
    // Get company final balance
    try {
      const finalCompanyInfo = await getAccount(connection, companyTokenAccount);
      logDetail("Company Final Balance", finalCompanyInfo.amount.toString());
    } catch (error) {
      logDetail("Company Final Balance", "Error fetching balance");
    }
    
    // Save report to file
    const report = {
      distributionId: dimitriInputExample.distributionId,
      timestamp: new Date().toISOString(),
      companyWallet: companyKeypair.publicKey.toString(),
      companyTokenAccount: companyTokenAccount.toString(),
      mint: mint.toString(),
      distributionAccount: distributionInfo.publicKey.toString(),
      totalGems,
      successfulTransfers,
      transactionHashes: {
        initialization: distributeTx,
        finalization: finalizeTx
      }
    };
    
    writeFileSync("distribution-report.json", JSON.stringify(report, null, 2));
    logDetail("Report Saved", "distribution-report.json");
    
  } catch (error) {
    logHeader("ERROR DURING DISTRIBUTION");
    console.error("Error details:", error);
  }
}

// Run the main function
main();