import { PublicKey, Transaction, Keypair, Connection, sendAndConfirmTransaction } from '@solana/web3.js';
  import {
    WhirlpoolContext,
    buildWhirlpoolClient,
    ORCA_WHIRLPOOL_PROGRAM_ID,
    PDAUtil,
    PoolUtil,
    PriceMath,
    WhirlpoolIx,
    toTx
  } from '@orca-so/whirlpools-sdk';
  import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
  import { BN, Wallet } from '@coral-xyz/anchor';
  import Decimal from 'decimal.js';
import { getKeypairFromEnvPath } from '../../utilss';
import { getSolanaConnection } from '../../utilss';


  // Connection to the Solana network
  const connection = getSolanaConnection();  
  const keypair = getKeypairFromEnvPath("COMPANY_WALLET_PATH");
  const wallet = new Wallet(keypair);
  
  // Create Whirlpool context
  const ctx = WhirlpoolContext.from(
    connection,
    wallet,
    ORCA_WHIRLPOOL_PROGRAM_ID
  );
  
  // Create Whirlpool client
  const client = buildWhirlpoolClient(ctx);



  
  async function initializeWhirlpool() {
    try {
      // ============ CONFIGURATION ============
      // Replace with your custom token mint address on Devnet (created via spl-token)
      const tokenAMint = new PublicKey("28Bv436Y6HNVmnHVpRYuXH7efuqsvBRKpsgoz4WHNgKB");
      
      // Verification: Ensure the mint is owned by the SPL Token program
      const mintInfo = await connection.getAccountInfo(tokenAMint);
      console.log("mintInfo", mintInfo);

    //   if (mintInfo === null || mintInfo.owner.toBase58() !== TOKEN_PROGRAM_ID.toBase58()) {
    //     console.error(`Error: Mint ${tokenAMint.toBase58()} is owned by ${mintInfo?.owner.toBase58() || 'none'}, expected SPL Token program`);
    //     process.exit(1);
    //   }
      
      const tokenBMint = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"); // WBTC mint address
      
      // Make sure tokenA and tokenB are in the correct order (lower pubkey first)
      const [tokenMintA, tokenMintB] = PoolUtil.orderMints(tokenAMint, tokenBMint);

      // Convert ordered mints to PublicKey for on-chain calls
      const tokenMintAPubKey = new PublicKey(tokenMintA.toString());
      console.log("tokenMintAPubKey", tokenMintAPubKey.toString());
      const tokenMintBPubKey = new PublicKey(tokenMintB.toString());
      console.log("tokenMintBPubKey", tokenMintBPubKey.toString());

     

      // Whirlpool configuration
      const configKeypair = Keypair.generate();
      const configPubkey = configKeypair.publicKey;
      const feeAuthority = wallet.publicKey;
      const collectProtocolFeesAuthority = wallet.publicKey;
      const rewardEmissionsSuperAuthority = wallet.publicKey;
      
      // Default fee tier (e.g., 0.3% fee = 3000)
      const defaultFeeTier = 3000;
      const tickSpacing = 64;
      
      // ============ INITIALIZE CONFIG ============
      console.log('Initializing Whirlpool config...');
      
      const initConfigIx = WhirlpoolIx.initializeConfigIx(
        ctx.program,
        {
          whirlpoolsConfigKeypair: configKeypair,
          feeAuthority,
          collectProtocolFeesAuthority,
          rewardEmissionsSuperAuthority,
          defaultProtocolFeeRate: 0, // Protocol fee rate (0 to 10000, representing 0% to 100%)
          funder: wallet.publicKey,
        }
      );
      
      // ============ INITIALIZE FEE TIER ============
      console.log('Initializing fee tier...');
      
      const feeTierPda = PDAUtil.getFeeTier(
        ctx.program.programId,
        configPubkey,
        tickSpacing,
      );
      
      const initFeeTierIx = WhirlpoolIx.initializeFeeTierIx(
        ctx.program,
        {
          whirlpoolsConfig: configPubkey,
          feeAuthority,
          feeTierPda: feeTierPda,
          tickSpacing: 64, // Standard tick spacing for 0.3% fee tier
          defaultFeeRate: defaultFeeTier, // Fee rate (3000 = 0.3%)
          funder: wallet.publicKey,
        }
      );
      
      // ============ INITIALIZE POOL ============
      console.log('Initializing Whirlpool...');
      
      // Initialize at a reasonable price for your token/WBTC pair
      // This is just an example - you should adjust based on the actual price
      const initialPrice = new Decimal(0.00001); // Example price of your token in terms of WBTC
      
      const tokenADecimals = await getMintDecimals(tokenMintAPubKey);
      const tokenBDecimals = await getMintDecimals(tokenMintBPubKey);
      
      const initialSqrtPrice = PriceMath.priceToSqrtPriceX64(
        initialPrice, 
        tokenADecimals, 
        tokenBDecimals
      );
        
      const whirlpoolPda = PDAUtil.getWhirlpool(
        ctx.program.programId,
        configPubkey,
        tokenMintAPubKey,
        tokenMintBPubKey,
        tickSpacing,
      );
      
      // Create token vault keypairs
      const tokenVaultAKeypair = Keypair.generate();
      const tokenVaultBKeypair = Keypair.generate();
      
      const initPoolIx = WhirlpoolIx.initializePoolIx(
        ctx.program,
        {
          whirlpoolsConfig: configPubkey,
          whirlpoolPda: whirlpoolPda,
          tokenMintA: tokenMintAPubKey,
          tokenMintB: tokenMintBPubKey,
          initSqrtPrice: initialSqrtPrice,
          tickSpacing: 64,
          tokenVaultAKeypair: tokenVaultAKeypair,
          tokenVaultBKeypair: tokenVaultBKeypair,
          feeTierKey: feeTierPda.publicKey,
          funder: wallet.publicKey,
        }
      );
      
      // ============ EXECUTE TRANSACTION ============
      // Convert instructions to transactions
      const tx = new Transaction();
      tx.add(initConfigIx.instructions[0]);
      tx.add(initFeeTierIx.instructions[0]);
      tx.add(initPoolIx.instructions[0]);
      
      tx.feePayer = wallet.publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      
      console.log('Sending transaction...');
      const signature = await sendAndConfirmTransaction(
        connection,
        tx,
        [
          keypair, 
          configKeypair, 
          tokenVaultAKeypair, 
          tokenVaultBKeypair
        ]
      );
      
      console.log('Transaction successful!');
      console.log(`Transaction Signature: ${signature}`);
      console.log(`Whirlpool Address: ${whirlpoolPda.publicKey.toString()}`);
      
      return {
        signature,
        whirlpoolAddress: whirlpoolPda.publicKey.toString(),
      };
    } catch (error) {
      console.error('Error initializing Whirlpool:', error);
      throw error;
    }
  }
  
  // Helper function to get mint decimals
  async function getMintDecimals(mintPubkey: PublicKey): Promise<number> {
    try {
      // In a real implementation, you'd fetch this from the blockchain
      // For example, using connection.getAccountInfo and decoding the data
      
      // For now, we're using hardcoded values for demonstration
      if (mintPubkey.toString() === 'WBTC_MINT_ADDRESS_HERE') {
        return 8; // WBTC typically has 8 decimals
      } else {
        return 9; // Common SPL token decimals, replace with your token's decimals
      }
    } catch (error) {
      console.error('Error fetching mint decimals:', error);
      throw error;
    }
  }
  
  // Execute the initialization
  initializeWhirlpool()
    .then((result) => {
      console.log('Initialization complete!');
      console.log(result);
    })
    .catch((err) => {
      console.error('Failed to initialize Whirlpool:', err);
    });