import * as anchor from "@coral-xyz/anchor";
import { 
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync
} from "@solana/spl-token";
import { 
  PublicKey, 
  Keypair, 
  SystemProgram, 
  SYSVAR_RENT_PUBKEY 
} from "@solana/web3.js";

// Define program ID directly from lib.rs declare_id!
const PROGRAM_ID = new PublicKey("AyU7HfAP36feEsNTfAifzLxDcT7kCYPER6HxWeb7czmX");

// This script simulates Dimitri's client-side interaction with your program

async function main() {
  // Configure provider and wallet
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const payer = provider.wallet as anchor.Wallet;
  
  // Create program instance
  // @ts-ignore - Ignore TypeScript errors for demo purposes
  const program = new anchor.Program({}, PROGRAM_ID, provider);
  
  console.log("Starting distribution simulation...");
  
  // Set up the mint (normally created by Sushank's program)
  const MINT_ADDRESS = "FW4FCdkZQ8GQXzNNQtYGYjW2ieJgwQGcBLQ4ZRpVRTXe"; // Replace with actual mint
  const mint = new PublicKey(MINT_ADDRESS);
  
  // Get the company's token account for this mint
  const companyTokenAccount = getAssociatedTokenAddressSync(
    mint,
    payer.publicKey
  );
  
  console.log(`Using existing mint: ${mint.toString()}`);
  console.log(`Using company token account: ${companyTokenAccount.toString()}`);
  
  // Simulate data coming from Dimitri's client
  const users = [
    { wallet: new PublicKey("5YNmS1R9nNSCDzb5a7mMJ1dwK9uHeAAF4CYuH1FLM6e3"), gems: 50 },
    { wallet: new PublicKey("ES8snGH1j1SxYMZMzjt9NTXzZmkazzN9omikHP5NmPZ4"), gems: 30 },
    { wallet: new PublicKey("6aR8Atv9Nnad3cHJBYUgjm5TdMByHjUDX4KD63TJ28RW"), gems: 20 },
  ];
  const totalGems = 100;
  
  // Validate the data
  console.log("Validating client data...");
  const totalGemsFromData = users.reduce((sum, user) => sum + user.gems, 0);
  if (totalGemsFromData !== totalGems) {
    console.error("Error: Total gems don't match the sum of user gems");
    return;
  }
  
  // Initialize the distribution
  console.log("Initializing token distribution...");
  
  // Create a distribution account
  const distributionInfo = Keypair.generate();
  
  // Format recipients for the program
  const recipients = users.map(user => ({
    wallet: user.wallet,
    gems: new anchor.BN(user.gems)
  }));

  try {
    // Initialize distribution
    const distributeTx = await program.methods
      .distributeTokens(recipients, new anchor.BN(totalGems))
      .accounts({
        mint: mint,
        sourceTokenAccount: companyTokenAccount,
        authority: payer.publicKey,
        distributionInfo: distributionInfo.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([distributionInfo])
      .rpc();
      
    console.log('Distribution initialized!');
    console.log(`   Transaction Signature: ${distributeTx}`);
    
    // Execute transfers for each user
    console.log("\nExecuting transfers for each user...");
    
    for (const user of users) {
      // Derive user's token account 
      const userTokenAccount = getAssociatedTokenAddressSync(
        mint,
        user.wallet
      );
      
      console.log(`Processing transfer for ${user.wallet.toString()} with ${user.gems} gems...`);
      
      try {
        // Execute the distribution
        const executeTx = await program.methods
          .executeDistribution(new anchor.BN(user.gems))
          .accounts({
            mint: mint,
            sourceTokenAccount: companyTokenAccount,
            destinationTokenAccount: userTokenAccount,
            authority: payer.publicKey,
            distributionInfo: distributionInfo.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
          
        console.log('Transfer successful!');
        console.log(`   Destination: ${user.wallet.toString()}`);
        console.log(`   Amount: ${user.gems} gems`);
        console.log(`   Transaction Signature: ${executeTx}`);
        
      } catch (error) {
        console.error(`Error transferring to ${user.wallet.toString()}:`, error);
      }
    }
    
    // Finalize the distribution
    console.log("\nFinalizing distribution...");
    
    const finalizeTx = await program.methods
      .finalizeDistribution()
      .accounts({
        authority: payer.publicKey,
        distributionInfo: distributionInfo.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
      
    console.log('Distribution finalized!');
    console.log(`   Transaction Signature: ${finalizeTx}`);
    console.log(`   Distribution completed successfully!`);
    
  } catch (error) {
    console.error("Error during distribution process:", error);
  }
}

// Run the main function
main();