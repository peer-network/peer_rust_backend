import { createSplashPool, setWhirlpoolsConfig, setRpc, setPayerFromBytes } from '@orca-so/whirlpools';
import { Connection } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';
import { address } from '@solana/kit';
import { getKeypairFromEnvPath } from "../../utilss";
import fs from 'fs';

async function main() {
  try {
    // Load your keypair
    const keypair = getKeypairFromEnvPath("COMPANY_WALLET_PATH");
    
    // Set up Orca configuration for devnet
    await setWhirlpoolsConfig('solanaDevnet');
    await setRpc('https://api.devnet.solana.com');
    
    // Define your token mints as Address types
    const tokenMintOneAddress = address("28Bv436Y6HNVmnHVpRYuXH7efuqsvBRKpsgoz4WHNgKB");
    const tokenMintTwoAddress = address("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
    // Convert to PublicKey for on-chain queries
    const tokenMintOnePubKey = new PublicKey(tokenMintOneAddress.toString());
    const tokenMintTwoPubKey = new PublicKey(tokenMintTwoAddress.toString());

    console.log(tokenMintOnePubKey.toBase58());
    console.log(tokenMintTwoPubKey.toBase58());
    // Verify that the custom mint exists on Devnet
    const connection = new Connection('https://api.devnet.solana.com');
    const mintInfo = await connection.getParsedAccountInfo(tokenMintOnePubKey);
    if (!mintInfo.value) {
      console.error(`Error: Mint ${tokenMintOnePubKey.toBase58()} does not exist on Devnet.`);
      process.exit(1);
    }
    
    // Set the initial price ratio between tokens
    const initialPrice = 1.000000000000000000;
    
    // Set the payer/signer from your keypair
    await setPayerFromBytes(new Uint8Array(keypair.secretKey));
    
    console.log('Creating Splash Pool...');
    
    // Create the splash pool with the correct parameters
    const { poolAddress, instructions, initializationCost, callback: sendTx } = await createSplashPool(
       
      tokenMintOneAddress,
      tokenMintTwoAddress,
      initialPrice
    );
    
    // Submit the transaction
    console.log('Sending transaction...');
    const txId = await sendTx();
    
    console.log(`Pool created successfully!`);
    console.log(`Pool Address: ${poolAddress.toString()}`);
    console.log(`Initialization Cost: ${initializationCost} lamports`);
    console.log(`Transaction ID: ${txId}`);
    
    // Optional: Save pool information to a file for future reference
    const poolInfo = {
      poolAddress: poolAddress.toString(),
      tokenMintA: tokenMintOneAddress.toString(),
      tokenMintB: tokenMintTwoAddress.toString(),
      initialPrice: initialPrice,
      txId: txId
    };
    
    fs.writeFileSync('./pool-info.json', JSON.stringify(poolInfo, null, 2));
    console.log('Pool information saved to pool-info.json');
    
  } catch (error: any) {
    console.error('Error creating pool:', error);
    if (error.cause) {
      console.error('Simulation cause:', error.cause);
    }
  }
}

main();