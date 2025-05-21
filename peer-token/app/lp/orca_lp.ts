import { 
  PublicKey, 
  Transaction, 
  Keypair, 
  Connection, 
  sendAndConfirmTransaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  TransactionInstruction
} from '@solana/web3.js';
import {
  WhirlpoolContext,
  buildWhirlpoolClient,
  ORCA_WHIRLPOOL_PROGRAM_ID,
  PDAUtil,
  PoolUtil,
  PriceMath,
  WhirlpoolIx,
  increaseLiquidityQuoteByInputToken,
  decreaseLiquidityQuoteByLiquidity,
  swapQuoteByInputToken,
  SwapUtils,  // Import the missing SwapUtils
  TokenExtensionContext,  // Import TokenExtensionContext for token extensions
  toTx
} from '@orca-so/whirlpools-sdk';
import { 
  TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { BN, Wallet } from '@coral-xyz/anchor';
import Decimal from 'decimal.js';
import { getMint, getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction } from '@solana/spl-token';
import { getIdl, getKeypairFromEnvPath, getPublicKey, getSolanaConnection } from '../../utilss';
import { Percentage } from '@orca-so/common-sdk'; // Import Percentage for slippage tolerance




const program_id = getPublicKey("PROGRAM_ID");
const TOKEN_METADATA_PROGRAM_ID = getPublicKey("TOKEN_METADATA_PROGRAM_ID");
const TOKEN_2022_PROGRAM_ID = getPublicKey("TOKEN_2022_PROGRAM_ID");
const companyWallet = getKeypairFromEnvPath("COMPANY_WALLET_PATH");
const connection = getSolanaConnection();
const idl = getIdl();
const keypair = getKeypairFromEnvPath("COMPANY_WALLET_PATH");
const wallet = new Wallet(keypair);

// Configuration
const PEER_TOKEN_MINT = new PublicKey("Ez5uXAp3AjQ38akioBZD8KZywm5o98pdancNfMhE47pj"); // Your token
const USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"); // Using this as the second token (you mentioned USDC)

const PEER_TOKEN_DECIMALS = 6; // Replace with your token's decimals
const USDC_DECIMALS = 6;



// Initial price for the pool (price of PEER in terms of USDC)
const INITIAL_PRICE = new Decimal(0.1); // Set your initial price here (e.g., 0.1 USDC per PEER)

// Amount of tokens to provide for initial liquidity
const PEER_LIQUIDITY_AMOUNT = 10000 * (10 ** PEER_TOKEN_DECIMALS); // 10,000 PEER tokens
const USDC_LIQUIDITY_AMOUNT = 1000 * (10 ** USDC_DECIMALS); // 1,000 USDC

// Percentage for slippage tolerance
// const ZERO_SLIPPAGE = new Percentage(new BN(0)); // Create proper Percentage object for slippage

// Connection to the Solana network
async function main() {
  try {
    console.log("Starting Peer Token Whirlpool Integration...");
    
    
    
    console.log(`Using wallet: ${wallet.publicKey.toString()}`);
    
    // Balance check
    const balance = await connection.getBalance(wallet.publicKey);
    console.log(`Wallet SOL balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    if (balance < 0.5 * LAMPORTS_PER_SOL) {
      console.warn("Warning: Low SOL balance for transactions");
    }
    
    // Create Whirlpool context and client
    const ctx = WhirlpoolContext.from(
      connection,
      wallet,
      ORCA_WHIRLPOOL_PROGRAM_ID
    );
    
    const client = buildWhirlpoolClient(ctx);
    
    // Verify token mint programs
    const peerMintInfo = await getMint(connection, PEER_TOKEN_MINT);
    console.log(`Peer Token Program ID: ${program_id.toString()}`);
    console.log(`Peer Token Decimals: ${peerMintInfo.decimals}`);
    
    if (program_id.toString() !== TOKEN_2022_PROGRAM_ID.toString()) {
      console.warn(`Warning: Peer token is not using Token-2022 program (${program_id.toString()})`);
    }
    
    // Initialize whirlpool components
    const { 
      configPubkey, 
      whirlpoolPubkey, 
      whirlpoolInitTx 
    } = await initializeWhirlpoolComponents(ctx, wallet, connection);
    
    console.log(`Whirlpool configuration created: ${configPubkey.toString()}`);
    console.log(`Whirlpool created: ${whirlpoolPubkey.toString()}`);
    
    // Add initial liquidity to the pool
    const addLiquidityResult = await addInitialLiquidity(
      ctx, 
      client, 
      connection, 
      wallet, 
      keypair, 
      whirlpoolPubkey
    );
    
    console.log("Initial liquidity added!");
    console.log(`Transaction signature: ${addLiquidityResult.signature}`);
    
    // Simulate a swap
    const swapResult = await simulateSwap(
      ctx, 
      client, 
      connection, 
      wallet, 
      keypair, 
      whirlpoolPubkey
    );
    
    console.log("Swap simulation complete!");
    console.log(`Transaction signature: ${swapResult.signature}`);
    console.log(`Swapped ${swapResult.inputAmount} PEER tokens for ${swapResult.outputAmount} USDC`);
    
    return {
      whirlpoolAddress: whirlpoolPubkey.toString(),
      initTxSignature: whirlpoolInitTx,
      liquidityTxSignature: addLiquidityResult.signature,
      swapTxSignature: swapResult.signature
    };

  } catch (error) {
    console.error('Error in Peer Token Whirlpool Integration:', error);
    throw error;
  }
}

async function initializeWhirlpoolComponents(
  ctx: WhirlpoolContext, 
  wallet: Wallet, 
  connection: Connection
) {
  try {
    console.log('Initializing Whirlpool components...');
    
    // Make sure tokens are in the correct order
    let [tokenMintA, tokenMintB] = PoolUtil.orderMints(PEER_TOKEN_MINT, USDC_MINT);
    tokenMintA = new PublicKey(tokenMintA.toString());
    tokenMintB = new PublicKey(tokenMintB.toString());
    
    console.log(`Token Mint A: ${tokenMintA.toString()}`);
    console.log(`Token Mint B: ${tokenMintB.toString()}`);
    
    // Whirlpool config
    const configKeypair = Keypair.generate();
    const configPubkey = configKeypair.publicKey;
    const feeAuthority = wallet.publicKey;
    const collectProtocolFeesAuthority = wallet.publicKey;
    const rewardEmissionsSuperAuthority = wallet.publicKey;
    
    // Default fee tier (0.3%)
    const defaultFeeTier = 3000;
    const tickSpacing = 64;
    
    // Initialize Whirlpool config
    const initConfigIx = WhirlpoolIx.initializeConfigIx(
      ctx.program,
      {
        whirlpoolsConfigKeypair: configKeypair,
        feeAuthority,
        collectProtocolFeesAuthority,
        rewardEmissionsSuperAuthority,
        defaultProtocolFeeRate: 0,
        funder: wallet.publicKey,
      }
    );
    
    // Initialize fee tier
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
        tickSpacing: tickSpacing,
        defaultFeeRate: defaultFeeTier,
        funder: wallet.publicKey,
      }
    );
    
    // Calculate initial sqrt price
    const tokenADecimals = await getMintInfo(connection, tokenMintA);
    const tokenBDecimals = await getMintInfo(connection, tokenMintB);
    
    
    const initialSqrtPrice = PriceMath.priceToSqrtPriceX64(
      INITIAL_PRICE, 
      tokenADecimals, 
      tokenBDecimals
    );
    
    // Create PDA for the whirlpool
    const whirlpoolPda = PDAUtil.getWhirlpool(
      ctx.program.programId,
      configPubkey,
      tokenMintA,
      tokenMintB,
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
        tokenMintA: tokenMintA,
        tokenMintB: tokenMintB,
        initSqrtPrice: initialSqrtPrice,
        tickSpacing: tickSpacing,
        tokenVaultAKeypair: tokenVaultAKeypair,
        tokenVaultBKeypair: tokenVaultBKeypair,
        feeTierKey: feeTierPda.publicKey,
        funder: wallet.publicKey,
      }
    );
    
    // Build and send transaction
    const tx = new Transaction();
    tx.add(initConfigIx.instructions[0]);
    tx.add(initFeeTierIx.instructions[0]);
    tx.add(initPoolIx.instructions[0]);
    
    tx.feePayer = wallet.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    
    console.log('Sending transaction to initialize Whirlpool...');
    
    const signature = await sendAndConfirmTransaction(
      connection,
      tx,
      [
        wallet.payer, 
        configKeypair, 
        tokenVaultAKeypair, 
        tokenVaultBKeypair
      ]
    );
    
    console.log(`Whirlpool initialization complete! Signature: ${signature}`);
    
    return {
      configPubkey,
      whirlpoolPubkey: whirlpoolPda.publicKey,
      whirlpoolInitTx: signature
    };
  } catch (error) {
    console.error('Error initializing Whirlpool components:', error);
    throw error;
  }
}

async function addInitialLiquidity(
  ctx: WhirlpoolContext,
  client: any,
  connection: Connection,
  wallet: Wallet,
  keypair: Keypair,
  whirlpoolPubkey: PublicKey
) {
  try {
    console.log('Adding initial liquidity to the Whirlpool...');
    
    // Fetch the whirlpool data
    const whirlpool = await client.getPool(whirlpoolPubkey);
    
    // Get token accounts for A and B
    const tokenA = whirlpool.getTokenAInfo();
    const tokenB = whirlpool.getTokenBInfo();
    
    console.log(`Token A: ${tokenA.mint.toString()}`);
    console.log(`Token B: ${tokenB.mint.toString()}`);
    
    // Calculate ATA addresses for both tokens
    const tokenAAtaAddress = getAssociatedTokenAddressSync(
      tokenA.mint,
      wallet.publicKey,
      false,
      tokenA.programId
    );
    
    const tokenBAtaAddress = getAssociatedTokenAddressSync(
      tokenB.mint,
      wallet.publicKey,
      false,
      tokenB.programId
    );

    // Create ATAs if they don't exist
    const ataIxs = [];
    
    ataIxs.push(
      createAssociatedTokenAccountIdempotentInstruction(
        wallet.publicKey,
        tokenAAtaAddress,
        wallet.publicKey,
        tokenA.mint,
        tokenA.programId
      )
    );
    
    ataIxs.push(
      createAssociatedTokenAccountIdempotentInstruction(
        wallet.publicKey,
        tokenBAtaAddress,
        wallet.publicKey,
        tokenB.mint,
        tokenB.programId
      )
    );
    
    // Create ATA transaction
    const ataTx = new Transaction();
    ataTx.add(...ataIxs);
    ataTx.feePayer = wallet.publicKey;
    ataTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    
    console.log('Creating token accounts if needed...');
    const ataSig = await sendAndConfirmTransaction(
      connection,
      ataTx,
      [keypair]
    );
    
    console.log(`Token accounts prepared. Signature: ${ataSig}`);
    
    // For simplicity, we'll create a position around the initial price
    const tickSpacingMultiplier = whirlpool.getData().tickSpacing;

    const tickLowerIndex = -10 * tickSpacingMultiplier;
    const tickUpperIndex = 10 * tickSpacingMultiplier;
    
    // Create position
    const positionMintKeypair = Keypair.generate();
    const positionPda = PDAUtil.getPosition(
      ctx.program.programId,
      positionMintKeypair.publicKey
    );
    
    // Create position instruction
    // const initPositionIx = WhirlpoolIx.openPositionIx(
    //   ctx.program,
    //   {
    //     funder: wallet.publicKey,
    //     owner: wallet.publicKey,
    //     positionPda,
    //     positionMint: positionMintKeypair.publicKey,
    //     whirlpool: whirlpoolPubkey,
    //     tickLowerIndex,
    //     tickUpperIndex,
    //   }
    // );
    
    // Calculate liquidity quote
    const tokenA_amount = tokenA.mint.equals(PEER_TOKEN_MINT) ? 
        PEER_LIQUIDITY_AMOUNT : 
        USDC_LIQUIDITY_AMOUNT;
    
    const tokenB_amount = tokenB.mint.equals(PEER_TOKEN_MINT) ? 
        PEER_LIQUIDITY_AMOUNT : 
        USDC_LIQUIDITY_AMOUNT;
    
    // const quote = increaseLiquidityQuoteByInputToken(
    //   tokenA.mint,
    //   new Decimal(tokenA_amount),
    //   tickLowerIndex,
    //   tickUpperIndex,
    //   whirlpool,
    //   wallet.publicKey,
    //   ctx.program.programId
    // );

    // Create increase liquidity ix
    // const increaseLiquidityIx = WhirlpoolIx.increaseLiquidityIx(
    //   ctx.program,
    //   {
    //     liquidityAmount: quote.liquidityAmount,
    //     tokenMaxA: quote.tokenMaxA,
    //     tokenMaxB: quote.tokenMaxB,
    //     whirlpool: whirlpoolPubkey,
    //     positionAuthority: wallet.publicKey,
    //     position: positionPda.publicKey,
    //     positionTokenAccount: getAssociatedTokenAddressSync(
    //       positionMintKeypair.publicKey,
    //       wallet.publicKey
    //     ),
    //     tokenOwnerAccountA: tokenAAtaAddress,
    //     tokenOwnerAccountB: tokenBAtaAddress,
    //     tokenVaultA: whirlpool.getData().tokenVaultA,
    //     tokenVaultB: whirlpool.getData().tokenVaultB,
    //     tickArrayLower: await whirlpool.getTickArrayPubkeyForTickIndex(tickLowerIndex, true),
    //     tickArrayUpper: await whirlpool.getTickArrayPubkeyForTickIndex(tickUpperIndex, true),
    //   }
    // );
    
    // Create transaction
//     const liquidityTx = new Transaction();
//     liquidityTx.add(...initPositionIx.instructions);
    
//     // Convert increaseLiquidityIx to TransactionInstruction and add it
//     const increaseLiquidityTx = toTx(increaseLiquidityIx);
//     liquidityTx.add(...increaseLiquidityTx.instructions);
    
//     liquidityTx.feePayer = wallet.publicKey;
//     liquidityTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    
//     console.log('Sending transaction to add liquidity...');
//     const signature = await sendAndConfirmTransaction(
//       connection,
//       liquidityTx,
//       [keypair, positionMintKeypair]
//     );
    
//     console.log(`Liquidity added successfully! Signature: ${signature}`);
//     console.log(`Position NFT: ${positionMintKeypair.publicKey.toString()}`);
    
//     return {
//       signature,
//       positionMint: positionMintKeypair.publicKey.toString(),
//       liquidity: quote.liquidityAmount.toString()
//     };
//   } catch (error) {
//     console.error('Error adding liquidity:', error);
//     throw error;
//   }
// }

async function simulateSwap(
  ctx: WhirlpoolContext,
  client: any,
  connection: Connection,
  wallet: Wallet,
  keypair: Keypair,
  whirlpoolPubkey: PublicKey
) {
  try {
    console.log('Simulating a swap in the Whirlpool...');
    
    // Fetch the whirlpool data
    const whirlpool = await client.getPool(whirlpoolPubkey);
    
    // Get token accounts
    const tokenA = whirlpool.getTokenAInfo();
    const tokenB = whirlpool.getTokenBInfo();
    
    // Calculate ATA addresses for both tokens
    const tokenAAtaAddress = getAssociatedTokenAddressSync(
      tokenA.mint,
      wallet.publicKey,
      false,
      tokenA.programId
    );
    
    const tokenBAtaAddress = getAssociatedTokenAddressSync(
      tokenB.mint,
      wallet.publicKey,
      false,
      tokenB.programId
    );
    
//     // Determine input and output based on Peer token
//     const isPeerA = tokenA.mint.equals(PEER_TOKEN_MINT);
    
//     // We'll swap PEER for USDC in this example
//     const inputMint = isPeerA ? tokenA.mint : tokenB.mint;
//     const outputMint = isPeerA ? tokenB.mint : tokenA.mint;
    
//     const inputTokenAccount = isPeerA ? tokenAAtaAddress : tokenBAtaAddress;
//     const outputTokenAccount = isPeerA ? tokenBAtaAddress : tokenAAtaAddress;
    
//     // Swap amount (100 PEER tokens)
//     const swapAmount = new BN(100 * (10 ** PEER_TOKEN_DECIMALS));
    
//     // Get swap quote with proper parameters
//     const quote = await swapQuoteByInputToken(
//       whirlpool,
//       inputMint,
//       swapAmount,
//       ZERO_SLIPPAGE, // Using proper Percentage object
//       ctx.program.programId,
//       whirlpool.getAccountFetcher() // Provide the account fetcher
//     );
    
//     // Build swap transaction using SwapUtils
//     const swapTx = await SwapUtils.buildSwapTransaction(
//       ctx,
//       whirlpool,
//       quote,
//       inputTokenAccount,
//       outputTokenAccount,
//       wallet.publicKey
//     );
    
//     // Convert to Transaction
//     const transaction = toTx(swapTx);
    
//     const swapTransaction = new Transaction();
//     swapTransaction.add(...transaction.instructions);
//     swapTransaction.feePayer = wallet.publicKey;
//     swapTransaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    
//     console.log('Sending swap transaction...');
//     const signature = await sendAndConfirmTransaction(
//       connection,
//       swapTransaction,
//       [keypair]
//     );
    
//     console.log(`Swap executed successfully! Signature: ${signature}`);
    
//     // Convert BN amounts to number for easier display
//     const inputAmountNumber = Number(swapAmount) / (10 ** (isPeerA ? PEER_TOKEN_DECIMALS : USDC_DECIMALS));
//     const outputAmountNumber = Number(quote.estimatedAmountOut) / (10 ** (isPeerA ? USDC_DECIMALS : PEER_TOKEN_DECIMALS));
    
//     return {
//       signature,
//       inputAmount: inputAmountNumber,
//       outputAmount: outputAmountNumber,
//       inputToken: isPeerA ? "PEER" : "USDC",
//       outputToken: isPeerA ? "USDC" : "PEER"
//     };
  } catch (error) {
    console.error('Error simulating swap:', error);
    throw error;
  }
}

// Helper function to get mint info and decimals
async function getMintInfo(connection: Connection, mintPubkey: PublicKey): Promise<number> {
  try {
    const mintInfo = await getMint(connection, mintPubkey);
    return mintInfo.decimals;
  } catch (error) {
    console.error(`Error fetching mint info for ${mintPubkey.toString()}:`, error);
    
    // Fallback values for testing
    if (mintPubkey.equals(PEER_TOKEN_MINT)) {
      return PEER_TOKEN_DECIMALS;
    } else if (mintPubkey.equals(USDC_MINT)) {
      return USDC_DECIMALS;
    }
    
    throw error;
  }
}

// Execute main function
main()
  .then((result) => {
    console.log('Peer Token Whirlpool Integration complete!');
    console.log(result);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Failed to complete Peer Token Whirlpool Integration:', err);
    process.exit(1);
  });