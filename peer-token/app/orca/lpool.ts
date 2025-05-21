import {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    sendAndConfirmTransaction,
    Signer,
    SystemProgram,
    LAMPORTS_PER_SOL,
  } from '@solana/web3.js';
  import {
    createInitializeMintInstruction,
    ExtensionType,
    getMintLen,
    getTokenMetadata,
    TOKEN_2022_PROGRAM_ID,
    createInitializeMetadataPointerInstruction,
    createInitializeTransferHookInstruction,
    createInitializeTokenInstruction,
    createMintToInstruction,
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountInstruction,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
  } from '@solana/spl-token';
  import {
    Whirlpool,
    WhirlpoolClient,
    AccountFetcher,
    buildWhirlpoolClient,
    ORCA_WHIRLPOOL_PROGRAM_ID,
    WhirlpoolContext,
    PDAUtil,
    PoolUtil,
    increaseLiquidityQuoteByInputToken,
    TICK_ARRAY_SIZE,
  } from '@orca-so/whirlpools-sdk';
  import { Provider } from '';
  import { DecimalUtil } from '@orca-so/common-sdk';
  import Decimal from 'decimal.js';
  import fs from 'fs';
  import { getKeypairFromEnvPath, getSolanaConnection } from '../../utilss';
import { Wallet } from '@coral-xyz/anchor';


  // Load environment variables or configuration
  const keypair= getKeypairFromEnvPath("COMPANY_WALLET_PATH");
  const connection =getSolanaConnection();
  const wallet=new Wallet(keypair);



  
  // Main function to execute the integration
  async function integratePeerTokenWithOrca() {
    try {
      console.log('Starting Peer Token (Token-2022) integration with Orca...');
      
      // Load wallet keypair
      console.log('Wallet loaded:', wallet.publicKey.toString());
      
      // Fund the wallet if needed (for testing)
      const walletBalance = await connection.getBalance(wallet.publicKey);
      if (walletBalance < LAMPORTS_PER_SOL) {
        console.log('Airdropping 2 SOL to wallet...');
        const signature = await connection.requestAirdrop(wallet.publicKey, 2 * LAMPORTS_PER_SOL);
        await connection.confirmTransaction(signature);
        console.log('Airdrop successful!');
      }
      
      // Reference to your existing Token-2022 Peer token mint
      // Replace with your actual mint address
      const peerTokenMint = new PublicKey('28Bv436Y6HNVmnHVpRYuXH7efuqsvBRKpsgoz4WHNgKB');
      console.log('Using Peer Token mint:', peerTokenMint.toString());
      
      // Create a wallet provider for Orca SDK
      const provider = new Provider(
        connection,
        {
          publicKey: wallet.publicKey,
          signTransaction: (tx: Transaction) => Promise.resolve(tx),
          signAllTransactions: (txs: Transaction[]) => Promise.resolve(txs),
        },
        { commitment: 'confirmed' }
      );
      
      // Create Orca client
      const orcaClient = buildWhirlpoolClient(provider, ORCA_WHIRLPOOL_PROGRAM_ID);
      const fetcher = new AccountFetcher(connection);
      const context = new WhirlpoolContext(
        provider, 
        ORCA_WHIRLPOOL_PROGRAM_ID, 
        fetcher
      );
      
      // Create a wrapped token for Token-2022 token to interact with Orca
      // This is our bridge between Token-2022 and standard SPL token
      console.log('Creating wrapped token for Token-2022 compatibility...');
      const wrappedTokenMint = await createWrappedToken(wallet, peerTokenMint);
      console.log('Wrapped token created:', wrappedTokenMint.toString());
      
      // Create liquidity pool with a common token (e.g., USDC on devnet)
      // For demonstration, let's use a devnet USDC representation
      // In production, use the actual USDC mint
      const usdcMint = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // Replace with devnet USDC if different
      
      // Create a whirlpool between wrapped token and USDC
      console.log('Creating Whirlpool for wrapped token and USDC...');
      const pool = await createWhirlpool(
        context,
        wallet,
        wrappedTokenMint,
        usdcMint,
        // Default values for a new pool:
        100, // fee tier (1% = 10_000)
        13, // tick spacing (determined by fee tier)
        new Decimal('1') // initial sqrt price (1:1 ratio to start)
      );
      console.log('Whirlpool created:', pool.toString());
      
      // Add initial liquidity to the pool
      console.log('Adding initial liquidity to the pool...');
      await addInitialLiquidity(
        context,
        wallet,
        pool,
        wrappedTokenMint,
        usdcMint,
        new Decimal('1000'), // amount of wrapped tokens to add
        new Decimal('1000')  // amount of USDC to add
      );
      console.log('Initial liquidity added successfully');
      
      // Create a UI helper to visualize the pool and provide instructions
      console.log('\n=== Peer Token Liquidity Pool Integration Complete ===');
      console.log('Peer Token (SPL Token-2022):', peerTokenMint.toString());
      console.log('Wrapped Token (Standard SPL):', wrappedTokenMint.toString());
      console.log('Whirlpool Address:', pool.toString());
      console.log('\nNext steps:');
      console.log('1. Use the wrapped token for all Orca SDK interactions');
      console.log('2. When users swap/deposit, convert between Token-2022 and wrapped token');
      console.log('3. Monitor both token accounts in your application');
      
      return {
        peerTokenMint: peerTokenMint.toString(),
        wrappedTokenMint: wrappedTokenMint.toString(),
        whirlpoolAddress: pool.toString()
      };
      
    } catch (error) {
      console.error('Error integrating Peer Token with Orca:', error);
      throw error;
    }
  }
  
  // Helper function to create a wrapped standard SPL token version of your Token-2022 token
  async function createWrappedToken(
    payer: Keypair,
    originalToken2022Mint: PublicKey
  ): Promise<PublicKey> {
    // Get token metadata from original Token-2022 token
    const tokenMetadata = await getTokenMetadata(
      connection,
      originalToken2022Mint,
      TOKEN_2022_PROGRAM_ID
    );
    
    // Create a new standard SPL token with the same metadata
    const mintKeypair = Keypair.generate();
    const mintAuthority = payer.publicKey;
    const freezeAuthority = payer.publicKey;
    
    // Get token decimals from original
    const originalMintInfo = await connection.getAccountInfo(originalToken2022Mint);
    const decimals = originalMintInfo.data[44]; // This is the position of decimals in mint data structure
    
    // Create mint account
    const lamports = await connection.getMinimumBalanceForRentExemption(
      getMintLen([])
    );
    
    const transaction = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: getMintLen([]),
        lamports,
        programId: TOKEN_PROGRAM_ID // Standard SPL Token program
      }),
      createInitializeMintInstruction(
        mintKeypair.publicKey,
        decimals,
        mintAuthority,
        freezeAuthority,
        TOKEN_PROGRAM_ID // Standard SPL Token program
      )
    );
    
    await sendAndConfirmTransaction(
      connection,
      transaction,
      [payer, mintKeypair],
      { commitment: 'confirmed' }
    );
    
    console.log(`Wrapped token mint created: ${mintKeypair.publicKey.toString()}`);
    return mintKeypair.publicKey;
  }
  
  // Helper function to create a whirlpool
  async function createWhirlpool(
    context: WhirlpoolContext,
    payer: Keypair,
    tokenMintA: PublicKey,
    tokenMintB: PublicKey,
    feeTier: number,
    tickSpacing: number,
    initialSqrtPrice: Decimal
  ): Promise<PublicKey> {
    // Sort token mints to ensure tokenA < tokenB (required by Orca)
    let [tokenA, tokenB] = [tokenMintA, tokenMintB];
    if (tokenMintA.toBuffer().compare(tokenMintB.toBuffer()) > 0) {
      [tokenA, tokenB] = [tokenMintB, tokenMintA];
    }
    
    // Find the WhirlpoolsConfig PDA
    const configPda = PDAUtil.getWhirlpoolsConfigPDA(
      ORCA_WHIRLPOOL_PROGRAM_ID
    );
    
    // Find the FeeTier PDA
    const feeTierPda = PDAUtil.getFeeTierPDA(
      ORCA_WHIRLPOOL_PROGRAM_ID,
      configPda.publicKey,
      feeTier,
      tickSpacing
    );
    
    // Find the Whirlpool PDA
    const whirlpoolPda = PDAUtil.getWhirlpoolPDA(
      ORCA_WHIRLPOOL_PROGRAM_ID,
      configPda.publicKey,
      tokenA,
      tokenB,
      tickSpacing
    );
    
    // Convert initial sqrt price to the format expected by Orca
    const initialSqrtPriceX64 = PoolUtil.calculateSqrtPriceX64(
      initialSqrtPrice
    );
    
    // Create the whirlpool
    const tx = await context.program.methods
      .initializePool(
        tickSpacing,
        initialSqrtPriceX64
      )
      .accounts({
        whirlpoolsConfig: configPda.publicKey,
        tokenMintA: tokenA,
        tokenMintB: tokenB,
        funder: payer.publicKey,
        whirlpool: whirlpoolPda.publicKey,
        tokenVaultA: PDAUtil.getVaultPDA(
          ORCA_WHIRLPOOL_PROGRAM_ID,
          whirlpoolPda.publicKey,
          tokenA
        ).publicKey,
        tokenVaultB: PDAUtil.getVaultPDA(
          ORCA_WHIRLPOOL_PROGRAM_ID,
          whirlpoolPda.publicKey,
          tokenB
        ).publicKey,
        feeTier: feeTierPda.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([payer])
      .rpc();
    
    await context.provider.connection.confirmTransaction(tx);
    return whirlpoolPda.publicKey;
  }
  
  // Helper function to add initial liquidity to the whirlpool
  async function addInitialLiquidity(
    context: WhirlpoolContext,
    payer: Keypair,
    whirlpoolAddress: PublicKey,
    tokenMintA: PublicKey,
    tokenMintB: PublicKey,
    amountA: Decimal,
    amountB: Decimal
  ): Promise<void> {
    // Fetch the whirlpool account data
    const whirlpool = await context.fetcher.getPool(whirlpoolAddress);
    
    // Create token accounts for the user if they don't exist
    const tokenAccountA = getAssociatedTokenAddressSync(
      tokenMintA,
      payer.publicKey,
      false,
      TOKEN_PROGRAM_ID
    );
    
    const tokenAccountB = getAssociatedTokenAddressSync(
      tokenMintB,
      payer.publicKey,
      false,
      TOKEN_PROGRAM_ID
    );
    
    // Create token accounts if they don't exist
    const transaction = new Transaction();
    
    try {
      await connection.getTokenAccountBalance(tokenAccountA);
    } catch (e) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          payer.publicKey,
          tokenAccountA,
          payer.publicKey,
          tokenMintA,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
    }
    
    try {
      await connection.getTokenAccountBalance(tokenAccountB);
    } catch (e) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          payer.publicKey,
          tokenAccountB,
          payer.publicKey,
          tokenMintB,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
    }
    
    // Mint tokens to the accounts if needed
    // This assumes you have minting authority over both tokens
    // For USDC on devnet, you'll need to get it another way (faucet or transfer)
    
    // Convert Decimal amounts to u64 token amounts based on decimals
    const mintInfoA = await connection.getParsedAccountInfo(tokenMintA);
    const decimalsA = mintInfoA.value.data.parsed.info.decimals;
    const tokenAmountA = DecimalUtil.toU64(amountA.mul(new Decimal(10).pow(decimalsA)));
    
    const mintInfoB = await connection.getParsedAccountInfo(tokenMintB);
    const decimalsB = mintInfoB.value.data.parsed.info.decimals;
    const tokenAmountB = DecimalUtil.toU64(amountB.mul(new Decimal(10).pow(decimalsB)));
    
    // Mint tokens to user accounts (if you have authority)
    transaction.add(
      createMintToInstruction(
        tokenMintA,
        tokenAccountA,
        payer.publicKey,
        tokenAmountA,
        [],
        TOKEN_PROGRAM_ID
      ),
      createMintToInstruction(
        tokenMintB,
        tokenAccountB,
        payer.publicKey,
        tokenAmountB,
        [],
        TOKEN_PROGRAM_ID
      )
    );
    
    await sendAndConfirmTransaction(
      connection,
      transaction,
      [payer],
      { commitment: 'confirmed' }
    );
    
    // Calculate the price range for liquidity
    // This sets a wide range for initial liquidity
    const currentTick = whirlpool.tickCurrentIndex;
    const tickLower = currentTick - 10 * whirlpool.tickSpacing;
    const tickUpper = currentTick + 10 * whirlpool.tickSpacing;
    
    // Initialize tick arrays if they don't exist
    const tickArrayLower = PDAUtil.getTickArrayPDA(
      ORCA_WHIRLPOOL_PROGRAM_ID,
      whirlpoolAddress,
      PoolUtil.getStartTickIndex(tickLower, whirlpool.tickSpacing, TICK_ARRAY_SIZE)
    );
    
    const tickArrayUpper = PDAUtil.getTickArrayPDA(
      ORCA_WHIRLPOOL_PROGRAM_ID,
      whirlpoolAddress,
      PoolUtil.getStartTickIndex(tickUpper, whirlpool.tickSpacing, TICK_ARRAY_SIZE)
    );
    
    // Initialize the tick arrays if needed
    // In a real scenario, check if they exist first
    try {
      await context.program.methods
        .initializeTickArray(
          PoolUtil.getStartTickIndex(tickLower, whirlpool.tickSpacing, TICK_ARRAY_SIZE)
        )
        .accounts({
          whirlpool: whirlpoolAddress,
          funder: payer.publicKey,
          tickArray: tickArrayLower.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([payer])
        .rpc();
    } catch (e) {
      // Tick array may already exist
      console.log("Lower tick array may already exist, continuing...");
    }
    
    try {
      await context.program.methods
        .initializeTickArray(
          PoolUtil.getStartTickIndex(tickUpper, whirlpool.tickSpacing, TICK_ARRAY_SIZE)
        )
        .accounts({
          whirlpool: whirlpoolAddress,
          funder: payer.publicKey,
          tickArray: tickArrayUpper.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([payer])
        .rpc();
    } catch (e) {
      // Tick array may already exist
      console.log("Upper tick array may already exist, continuing...");
    }
    
    // Create a position PDA
    const positionMintKeypair = Keypair.generate();
    const positionPda = PDAUtil.getPositionPDA(
      ORCA_WHIRLPOOL_PROGRAM_ID,
      positionMintKeypair.publicKey
    );
    
    // Create position token account
    const positionTokenAccount = getAssociatedTokenAddressSync(
      positionMintKeypair.publicKey,
      payer.publicKey,
      false
    );
    
    // Calculate liquidity amounts
    const quote = increaseLiquidityQuoteByInputToken(
      tokenMintA,
      tokenAmountA,
      tokenMintB,
      tokenAmountB,
      Decimal.max(amountA, amountB),
      tickLower,
      tickUpper,
      whirlpool
    );
    
    // Create the position and add liquidity in a single transaction
    await context.increaseLiquidityWithFixedToken(
      {
        whirlpool: whirlpoolAddress,
        position: positionPda.publicKey,
        positionMint: positionMintKeypair.publicKey,
        positionTokenAccount,
        tokenOwnerAccountA: tokenAccountA,
        tokenOwnerAccountB: tokenAccountB,
        tokenVaultA: whirlpool.tokenVaultA,
        tokenVaultB: whirlpool.tokenVaultB,
        tickArrayLower: tickArrayLower.publicKey,
        tickArrayUpper: tickArrayUpper.publicKey,
      },
      {
        liquidityAmount: quote.liquidityAmount,
        tokenMaxA: tokenAmountA,
        tokenMaxB: tokenAmountB,
      },
      payer
    );
    
    console.log("Liquidity position created:", positionPda.publicKey.toString());
  }
  
  // Bridge function to convert between Token-2022 and standard SPL token
  async function convertToken2022ToWrappedToken(
    wallet: Keypair,
    amount: number,
    originalTokenMint: PublicKey,
    wrappedTokenMint: PublicKey
  ): Promise<void> {
    // This function demonstrates the concept of bridging between Token-2022 and standard SPL
    // In a real application, you might need to create a bridge service or program that locks
    // the original tokens and mints the wrapped ones
    
    // Get token accounts
    const originalTokenAccount = getAssociatedTokenAddressSync(
      originalTokenMint,
      wallet.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID
    );
    
    const wrappedTokenAccount = getAssociatedTokenAddressSync(
      wrappedTokenMint,
      wallet.publicKey,
      false,
      TOKEN_PROGRAM_ID
    );
    
    console.log("Converting Token-2022 to wrapped token...");
    console.log("Original token account:", originalTokenAccount.toString());
    console.log("Wrapped token account:", wrappedTokenAccount.toString());
    
    // In a real implementation, you would:
    // 1. Create a bridge program that locks the original tokens
    // 2. Mint the equivalent amount of wrapped tokens
    // 3. Allow the reverse operation
    
    console.log("NOTE: This is a conceptual implementation.");
    console.log("For production use, implement a secure bridge program that:");
    console.log("1. Locks the original Token-2022 tokens in an escrow");
    console.log("2. Mints equivalent wrapped tokens");
    console.log("3. Allows reversing the process (burning wrapped & releasing original)");
  }
  
  // Execute the main function
  integratePeerTokenWithOrca()
    .then(result => {
      console.log("Integration completed successfully!");
      console.log(result);
    })
    .catch(error => {
      console.error("Integration failed:", error);
    });