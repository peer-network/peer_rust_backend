import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenBasics } from "../target/types/peer_token";
import { PublicKey, Keypair, LAMPORTS_PER_SOL, Transaction } from "@solana/web3.js";
import { 
  ASSOCIATED_TOKEN_PROGRAM_ID, 
  TOKEN_2022_PROGRAM_ID, 
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction
} from "@solana/spl-token";
import { assert } from "chai";

import * as fs from 'fs';
import * as path from 'path';

export function loadKeypairFromFile(filename: string): Keypair {
    const filePath = path.resolve(__dirname, '../.keys', filename);
    try {
        const keypairString = fs.readFileSync(filePath, 'utf-8');
        const keypairData = JSON.parse(keypairString);
        return Keypair.fromSecretKey(new Uint8Array(keypairData));
    } catch (error) {
        console.error(`Error loading keypair from ${filePath}:`, error);
        throw error;
    }
}

describe("peer_token", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenBasics as Program<TokenBasics>;
  
  // Test variables
  const wallet = provider.wallet as anchor.Wallet;
  const mintKeypair = Keypair.generate();
  let recipient: Keypair;
  
  // Try to load recipient from file, or generate a new one
  try {
    recipient = loadKeypairFromFile('recipient.json');
  } catch (error) {
    recipient = Keypair.generate();
    console.log("Generated new recipient keypair");
  }
  
  const tokenName = "Test Token";
  const tokenSymbol = "TEST";
  const tokenUri = "https://test.com/metadata";
  const mintAmount = 1000_000_000; // 1 token with 9 decimals
  const burnAmount = 500_000_000; // 0.5 token with 9 decimals
  const transferAmount = 200_000_000; // 0.2 token with 9 decimals

  // Setup token accounts
  let walletTokenAccount: PublicKey;
  let recipientTokenAccount: PublicKey;

  // Fund recipient for tests
  before(async () => {
    try {
      // airdrop to recipient
      const tx = await provider.connection.requestAirdrop(recipient.publicKey, 1000 * LAMPORTS_PER_SOL);
      await provider.connection.confirmTransaction({
        signature: tx,
        ...(await provider.connection.getLatestBlockhash()),
      });

      //airdrop to wallet
      const tx2 = await provider.connection.requestAirdrop(wallet.publicKey, 1000 * LAMPORTS_PER_SOL);
      await provider.connection.confirmTransaction({
        signature: tx2,
        ...(await provider.connection.getLatestBlockhash()),
      });
      
      // Calculate the associated token accounts
      walletTokenAccount = getAssociatedTokenAddressSync(
        mintKeypair.publicKey,
        wallet.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      recipientTokenAccount = getAssociatedTokenAddressSync(
        mintKeypair.publicKey,
        recipient.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      console.log("Wallet public key:", wallet.publicKey.toBase58());
      console.log("Wallet token account:", walletTokenAccount.toBase58());
      console.log("Recipient public key:", recipient.publicKey.toBase58());
      console.log("Recipient token account:", recipientTokenAccount.toBase58());
    } catch (error) {
      console.error("Error in before hook:", error);
      throw error;
    }
  });

  it("Create a new token", async () => {
    try {
      const tx = await program.methods
        .createToken(tokenName, tokenSymbol, tokenUri)
        .accounts({
          authority: wallet.publicKey,
          mint: mintKeypair.publicKey,
          tokenProgram2022: TOKEN_2022_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([mintKeypair])
        .rpc();

      console.log("Create token transaction signature", tx);

      // Verify the mint account was created
      const mintAccount = await provider.connection.getAccountInfo(mintKeypair.publicKey);
      assert(mintAccount !== null, "Mint account should exist");
    } catch (error) {
      console.error("Error creating token:", error);
      if (error.logs) console.error("Logs:", error.logs);
      throw error;
    }
  });

  it("Mint tokens to the wallet", async () => {
    try {
      // Create the wallet ATA first if needed
      try {
        console.log("Creating wallet's ATA manually...");
        
        // Create instruction to make the wallet ATA
        const createAtaIx = createAssociatedTokenAccountInstruction(
          wallet.publicKey,         // payer
          walletTokenAccount,       // associated token account address
          wallet.publicKey,         // owner
          mintKeypair.publicKey,    // mint
          TOKEN_2022_PROGRAM_ID,    // token program
          ASSOCIATED_TOKEN_PROGRAM_ID // associated token program
        );
        
        // Create and send transaction
        const ataTx = new Transaction().add(createAtaIx);
        const signature = await provider.sendAndConfirm(ataTx);
        console.log("Wallet ATA creation signature:", signature);
      } catch (error) {
        // If it fails because the account already exists, that's fine
        console.log("Wallet ATA creation error (might already exist):", error.message);
      }

      // Now mint tokens to the wallet with updated account structure
      const tx = await program.methods
        .mintToken(new anchor.BN(mintAmount))
        .accounts({
          authority: wallet.publicKey,     // Authority account
          recipient: wallet.publicKey,     // The recipient is the wallet owner
          mint: mintKeypair.publicKey,
          recipientTokenAccount: walletTokenAccount, // Updated from tokenAccount to recipientTokenAccount
          tokenProgram2022: TOKEN_2022_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      console.log("Mint token transaction signature", tx);

      // Check balance after minting
      const accountInfo = await provider.connection.getTokenAccountBalance(walletTokenAccount);
      console.log("Wallet token balance:", accountInfo.value.amount);
      assert.equal(accountInfo.value.amount, mintAmount.toString(), "Token balance should match minted amount");
    } catch (error) {
      console.error("Error minting token:", error);
      if (error.logs) console.error("Logs:", error.logs);
      throw error;
    }
  });

  let recipientInitialBalance = 0;

  it("Transfer tokens to recipient", async () => {
    try {
      // First manually create the recipient's ATA
      console.log("Creating recipient's ATA manually...");
      
      // Log all the public keys for debugging
      console.log("wallet.publicKey", wallet.publicKey.toBase58());
      console.log("recipient.publicKey", recipient.publicKey.toBase58());
      console.log("mintKeypair.publicKey", mintKeypair.publicKey.toBase58());
      console.log("recipientTokenAccount", recipientTokenAccount.toBase58());
      
      // Create instruction to make the recipient ATA
      const createAtaIx = createAssociatedTokenAccountInstruction(
        wallet.publicKey,          // payer
        recipientTokenAccount,     // associated token account address
        recipient.publicKey,       // owner
        mintKeypair.publicKey,     // mint
        TOKEN_2022_PROGRAM_ID,     // token program
        ASSOCIATED_TOKEN_PROGRAM_ID // associated token program
      );
      
      // Create and send transaction
      const ataTx = new Transaction().add(createAtaIx);
      const signature = await provider.sendAndConfirm(ataTx);
      console.log("Recipient ATA creation signature:", signature);
      
      // Wait for confirmation
      await provider.connection.confirmTransaction(signature);
      
      // Verify recipient ATA exists
      const recipientAtaInfo = await provider.connection.getAccountInfo(recipientTokenAccount);
      console.log("Recipient ATA created:", recipientAtaInfo !== null);
      
      // Mint a small amount to the recipient
      recipientInitialBalance = 1; // Set to small amount
      
      const mintTx = await program.methods
        .mintToken(new anchor.BN(recipientInitialBalance))
        .accounts({
          authority: wallet.publicKey,     // Authority account
          recipient: recipient.publicKey,  // Recipient is now the recipient account
          mint: mintKeypair.publicKey,
          recipientTokenAccount: recipientTokenAccount, // Updated from tokenAccount to recipientTokenAccount
          tokenProgram2022: TOKEN_2022_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      console.log("Mint to recipient signature:", mintTx);
      
      // Verify recipient's initial balance
      const initialBalanceInfo = await provider.connection.getTokenAccountBalance(recipientTokenAccount);
      console.log("Recipient initial balance:", initialBalanceInfo.value.amount);
      assert.equal(initialBalanceInfo.value.amount, recipientInitialBalance.toString(), 
        "Recipient should have initial tokens");

      // Now transfer tokens - with updated account names
      const transferTx = await program.methods
        .transferToken(new anchor.BN(transferAmount))
        .accounts({
          authority: wallet.publicKey,
          mint: mintKeypair.publicKey,
          senderTokenAccount: walletTokenAccount,      // Changed from fromTokenAccount
          recipientTokenAccount: recipientTokenAccount, // Changed from toTokenAccount
          recipient: recipient.publicKey,               // New: explicit recipient account
          tokenProgram2022: TOKEN_2022_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      console.log("Transfer token transaction signature", transferTx);

      // Check balances after transfer
      const senderBalance = await provider.connection.getTokenAccountBalance(walletTokenAccount);
      const recipientBalance = await provider.connection.getTokenAccountBalance(recipientTokenAccount);
      
      console.log("Sender balance after transfer:", senderBalance.value.amount);
      console.log("Recipient balance after transfer:", recipientBalance.value.amount);
      
      // Should have mintAmount - transferAmount
      assert.equal(
        senderBalance.value.amount, 
        (mintAmount - transferAmount).toString(), 
        "Sender balance should reflect transfer"
      );
      
      // Recipient should have transferAmount + initial balance
      assert.equal(
        recipientBalance.value.amount, 
        (transferAmount + recipientInitialBalance).toString(), 
        "Recipient balance should reflect transfer"
      );
    } catch (error) {
      console.error("Error transferring token:", error);
      if (error.logs) console.error("Logs:", error.logs);
      throw error;
    }
  });

  it("Burn tokens from wallet", async () => {
    try {
      // Wallet should have mintAmount - transferAmount tokens before burning
      const remainingBalance = mintAmount - transferAmount;
      console.log("Remaining balance before burn:", remainingBalance);
      console.log("Burn amount:", burnAmount);
      console.log("Expected balance after burn:", remainingBalance - burnAmount);
      
      const tx = await program.methods
        .burnToken(new anchor.BN(burnAmount))
        .accounts({
          authority: wallet.publicKey,
          mint: mintKeypair.publicKey,
          tokenAccount: walletTokenAccount,
          tokenProgram2022: TOKEN_2022_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      console.log("Burn token transaction signature", tx);

      // Check balance after burning
      const accountInfo = await provider.connection.getTokenAccountBalance(walletTokenAccount);
      console.log("Wallet balance after burning:", accountInfo.value.amount);
      
      assert.equal(
        accountInfo.value.amount, 
        (remainingBalance - burnAmount).toString(), 
        "Token balance should reflect burned amount"
      );

      // Total supply = initial wallet mint + initial recipient mint - burn amount
      // which is: mintAmount + recipientInitialBalance - burnAmount
      const expectedSupply = mintAmount + recipientInitialBalance - burnAmount;
      
      // Check total supply has decreased
      const mintInfo = await provider.connection.getTokenSupply(mintKeypair.publicKey);
      console.log("Total supply after burning:", mintInfo.value.amount);
      console.log("Expected total supply:", expectedSupply.toString());
      
      assert.equal(
        mintInfo.value.amount, 
        expectedSupply.toString(), 
        "Total supply should be decreased by burned amount"
      );
    } catch (error) {
      console.error("Error burning token:", error);
      if (error.logs) console.error("Logs:", error.logs);
      throw error;
    }
  });
});