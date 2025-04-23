import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PeerToken } from "../target/types/peer_token";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { assert } from "chai";

describe("peer-token", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.PeerToken as Program<PeerToken>;
  
  // Test wallets
  const mint = Keypair.generate();
  const company = provider.wallet; // Company wallet that will distribute tokens
  const user1 = Keypair.generate();
  const user2 = Keypair.generate();
  const user3 = Keypair.generate();
  
  // Token accounts
  let companyTokenAccount: PublicKey;
  let user1TokenAccount: PublicKey;
  let user2TokenAccount: PublicKey;
  let user3TokenAccount: PublicKey;
  
  // Initial mint amount
  const TOTAL_SUPPLY = 1_000_000_000; // 1 billion tokens
  
  // User gem counts
  const user1Gems = 50;
  const user2Gems = 30;
  const user3Gems = 20;
  const totalGems = user1Gems + user2Gems + user3Gems; // 100 gems total
  
  before(async () => {
    // Create mint
    await createMint(
      provider.connection,
      (provider.wallet as any).payer,
      company.publicKey,
      null,
      9, // 9 decimals
      mint
    );
    
    console.log("Created mint:", mint.publicKey.toString());
    
    // Create company token account
    companyTokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      (provider.wallet as any).payer,
      mint.publicKey,
      company.publicKey
    );
    
    console.log("Created company token account:", companyTokenAccount.toString());
    
    // Mint tokens to company account
    await mintTo(
      provider.connection,
      (provider.wallet as any).payer,
      mint.publicKey,
      companyTokenAccount,
      company.publicKey,
      TOTAL_SUPPLY
    );
    
    console.log(`Minted ${TOTAL_SUPPLY} tokens to company account`);
    
    // Airdrop SOL to users for account creation
    for (const user of [user1, user2, user3]) {
      const signature = await provider.connection.requestAirdrop(
        user.publicKey,
        anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(signature);
    }
    
    // Create user token accounts
    user1TokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      (provider.wallet as any).payer,
      mint.publicKey,
      user1.publicKey
    );
    
    user2TokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      (provider.wallet as any).payer,
      mint.publicKey,
      user2.publicKey
    );
    
    user3TokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      (provider.wallet as any).payer,
      mint.publicKey,
      user3.publicKey
    );
    
    console.log("Created user token accounts");
  });

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Initialization transaction signature:", tx);
  });
  
  it("Can distribute tokens based on gem counts", async () => {
    // Create distribution info account
    const distributionInfo = Keypair.generate();
    
    // Define recipients with their wallet and gem counts
    const recipients = [
      { wallet: user1.publicKey, gems: new anchor.BN(user1Gems) },
      { wallet: user2.publicKey, gems: new anchor.BN(user2Gems) },
      { wallet: user3.publicKey, gems: new anchor.BN(user3Gems) },
    ];
    
    // Initialize the distribution
    console.log("Initializing token distribution...");
    const distributionTx = await program.methods
      .distributeTokens(recipients, new anchor.BN(totalGems))
      .accounts({
        mint: mint.publicKey,
        sourceTokenAccount: companyTokenAccount,
        authority: company.publicKey,
        distributionInfo: distributionInfo.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([distributionInfo])
      .rpc();
      
    console.log("Distribution initialization signature:", distributionTx);
    
    // Execute distributions for each user
    
    // User 1 - 50% of tokens (50 gems out of 100 total)
    console.log("Distributing tokens to User 1...");
    const tx1 = await program.methods
      .executeDistribution(new anchor.BN(user1Gems))
      .accounts({
        mint: mint.publicKey,
        sourceTokenAccount: companyTokenAccount,
        destinationTokenAccount: user1TokenAccount,
        authority: company.publicKey,
        distributionInfo: distributionInfo.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
      
    console.log("Distribution to User 1 signature:", tx1);
    
    // User 2 - 30% of tokens (30 gems out of 100 total)
    console.log("Distributing tokens to User 2...");
    const tx2 = await program.methods
      .executeDistribution(new anchor.BN(user2Gems))
      .accounts({
        mint: mint.publicKey,
        sourceTokenAccount: companyTokenAccount,
        destinationTokenAccount: user2TokenAccount,
        authority: company.publicKey,
        distributionInfo: distributionInfo.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
      
    console.log("Distribution to User 2 signature:", tx2);
    
    // User 3 - 20% of tokens (20 gems out of 100 total)
    console.log("Distributing tokens to User 3...");
    const tx3 = await program.methods
      .executeDistribution(new anchor.BN(user3Gems))
      .accounts({
        mint: mint.publicKey,
        sourceTokenAccount: companyTokenAccount,
        destinationTokenAccount: user3TokenAccount,
        authority: company.publicKey,
        distributionInfo: distributionInfo.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
      
    console.log("Distribution to User 3 signature:", tx3);
    
    // Finalize the distribution
    console.log("Finalizing distribution...");
    const finalizeTx = await program.methods
      .finalizeDistribution()
      .accounts({
        authority: company.publicKey,
        distributionInfo: distributionInfo.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
      
    console.log("Distribution finalization signature:", finalizeTx);
    
    // Verify the token distributions
    const balance1 = await provider.connection.getTokenAccountBalance(user1TokenAccount);
    const balance2 = await provider.connection.getTokenAccountBalance(user2TokenAccount);
    const balance3 = await provider.connection.getTokenAccountBalance(user3TokenAccount);
    
    console.log("User 1 balance:", balance1.value.uiAmount);
    console.log("User 2 balance:", balance2.value.uiAmount);
    console.log("User 3 balance:", balance3.value.uiAmount);
    
    // Expected amounts based on percentages
    const expectedUser1 = TOTAL_SUPPLY * (user1Gems / totalGems);
    const expectedUser2 = TOTAL_SUPPLY * (user2Gems / totalGems);
    const expectedUser3 = TOTAL_SUPPLY * (user3Gems / totalGems);
    
    // Verify token balances with approximation for potential rounding
    assert.approximately(
      balance1.value.uiAmount || 0,
      expectedUser1,
      10, // Allow small rounding errors
      "User 1 balance doesn't match expected percentage"
    );
    
    assert.approximately(
      balance2.value.uiAmount || 0,
      expectedUser2,
      10, // Allow small rounding errors
      "User 2 balance doesn't match expected percentage"
    );
    
    assert.approximately(
      balance3.value.uiAmount || 0,
      expectedUser3,
      10, // Allow small rounding errors
      "User 3 balance doesn't match expected percentage"
    );
    
    // Check remaining company balance
    const companyBalance = await provider.connection.getTokenAccountBalance(companyTokenAccount);
    console.log("Remaining company balance:", companyBalance.value.uiAmount);
  });
});
