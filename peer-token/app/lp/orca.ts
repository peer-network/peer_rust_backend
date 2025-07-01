import {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    sendAndConfirmTransaction,
    SystemProgram,
  } from '@solana/web3.js';
  import {
    WhirlpoolContext,
    buildWhirlpoolClient,
    ORCA_WHIRLPOOL_PROGRAM_ID,
    WhirlpoolIx,
    PDAUtil,
    toTx,
    PriceMath,
  } from '@orca-so/whirlpools-sdk';
  import { Wallet, BN } from '@coral-xyz/anchor';
  import {
    TOKEN_2022_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    getMint,
  } from '@solana/spl-token';
  import { DecimalUtil, Percentage } from '@orca-so/common-sdk';
  import Decimal from 'decimal.js';
  import { getSolanaConnection, getKeypairFromEnvPath, getPublicKey } from '../../utilss';
  
  // Your config
  const TOKEN_A_MINT = new PublicKey('C5dHbGgAU8ZcaagG5sGeiTBRRayL62nyCy7wsJpLo2W2'); // e.g., PEER Token
  const TOKEN_B_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'); // e.g., Devnet USDC
  const TICK_SPACING = 64; // e.g. 64 for 0.3%
  const FEE_RATE = 3000; // 0.3%
  const program_id = getPublicKey("PROGRAM_ID");
  
  async function main() {
    try {
      const connection = getSolanaConnection();
      const keypair = getKeypairFromEnvPath('ADMIN_WALLET_PATH');
      const wallet = new Wallet(keypair);
      

      console.log("🚀 Starting Whirlpool V2 initialization...");

      // Check token mint info
      const accountInfo = await connection.getAccountInfo(TOKEN_A_MINT);
      console.log("Mint owner:", accountInfo?.owner.toBase58());
  
      const ctx = WhirlpoolContext.from(connection, wallet, ORCA_WHIRLPOOL_PROGRAM_ID);
      const client = buildWhirlpoolClient(ctx);

       // Get your PDA mint
       const [mintPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("peer-token")],
        program_id
      );

      // Determine which token is which
      const actualTokenA = TOKEN_A_MINT.equals(mintPda) ? mintPda : TOKEN_A_MINT;
      
      console.log(`Token A: ${actualTokenA.toString()}`);
      console.log(`Token B: ${TOKEN_B_MINT.toString()}`);
  
      // 1. Create WhirlpoolsConfig
      const whirlpoolsConfigKeypair = Keypair.generate();
      const whirlpoolsConfig = whirlpoolsConfigKeypair.publicKey;
  
      console.log("📝 Creating WhirlpoolsConfig...");
      const configIx = WhirlpoolIx.initializeConfigIx(ctx.program, {
        whirlpoolsConfigKeypair,
        funder: wallet.publicKey,
        feeAuthority: wallet.publicKey,
        collectProtocolFeesAuthority: wallet.publicKey,
        rewardEmissionsSuperAuthority: wallet.publicKey,
        defaultProtocolFeeRate: 0,
      });
  
    
  
      // 2. Create FeeTier
      console.log("📝 Creating FeeTier...");
      const feeTierPda = PDAUtil.getFeeTier(
        ctx.program.programId,
        whirlpoolsConfig,
        TICK_SPACING
      );
  
      const feeTierIx = WhirlpoolIx.initializeFeeTierIx(ctx.program, {
        whirlpoolsConfig,
        feeTierPda,
        feeAuthority: wallet.publicKey,
        tickSpacing: TICK_SPACING,
        defaultFeeRate: FEE_RATE,
        funder: wallet.publicKey,
      });
  
      // 3. Order tokens properly (tokenA < tokenB)
      const [tokenMintA, tokenMintB] = [actualTokenA, TOKEN_B_MINT].sort((a, b) => 
        a.toBuffer().compare(b.toBuffer())
      );
      

      console.log(`Ordered Token A: ${tokenMintA.toString()}`);
      console.log(`Ordered Token B: ${tokenMintB.toString()}`);


      const whirlpoolPda = PDAUtil.getWhirlpool(
        ctx.program.programId,
        whirlpoolsConfig,
        tokenMintA,
        tokenMintB,
        TICK_SPACING
      );
      console.log("whirlpoolPda", whirlpoolPda.publicKey.toString());
  
      // 4. Determine token programs and fetch mint info
      async function getTokenProgram(mint: PublicKey): Promise<PublicKey> {
        const accountInfo = await connection.getAccountInfo(mint);
        if (accountInfo && accountInfo.owner.equals(TOKEN_2022_PROGRAM_ID)) {
          return TOKEN_2022_PROGRAM_ID;
        }
        return TOKEN_PROGRAM_ID;
      }
  
      const tokenProgramA = await getTokenProgram(tokenMintA);
      const tokenProgramB = await getTokenProgram(tokenMintB);
  
      // Use the correct mint address (mintPda vs TOKEN_A_MINT)
      const actualMintA = tokenMintA.equals(TOKEN_A_MINT) ? mintPda : tokenMintA;
      
      const mintA = await getMint(connection, actualMintA, 'confirmed', tokenProgramA);
      const mintB = await getMint(connection, tokenMintB, 'confirmed', tokenProgramB);
      
      console.log("mintA decimals:", mintA.decimals);
      console.log("mintB decimals:", mintB.decimals);
  
      // 5. Calculate initial price properly
      const initialPrice = 0.1; // tokenA/tokenB price
      
      // Convert to Decimal and calculate sqrt price
      const priceDecimal = new Decimal(initialPrice);
      const sqrtPriceX64 = PriceMath.priceToSqrtPriceX64(
        priceDecimal,
        mintA.decimals,
        mintB.decimals
      );
  
      // Convert Decimal to BN for the instruction
      const initSqrtPrice = new BN(sqrtPriceX64.toString());
      console.log("Initial sqrt price:", initSqrtPrice.toString());
  
      // 6. Create token vault keypairs (as required by the SDK)
      const tokenVaultAKeypair = Keypair.generate();
      const tokenVaultBKeypair = Keypair.generate();
  
      // 7. Get token badges
      const tokenBadgeA = PDAUtil.getTokenBadge(ctx.program.programId, whirlpoolsConfig, tokenMintA);
      const tokenBadgeB = PDAUtil.getTokenBadge(ctx.program.programId, whirlpoolsConfig, tokenMintB);
  
      console.log("tokenBadgeA:", tokenBadgeA.publicKey.toString());
      console.log("tokenBadgeB:", tokenBadgeB.publicKey.toString());
  
      // 8. Build `initializePoolV2Ix` with correct parameters based on your SDK interface
      console.log("🏊 Creating Pool...");
      const poolIx = WhirlpoolIx.initializePoolV2Ix(ctx.program, {
        initSqrtPrice: initSqrtPrice, // BN type as expected
        whirlpoolsConfig: whirlpoolsConfig,
        whirlpoolPda: whirlpoolPda, // PDA type as expected
        tokenMintA,
        tokenMintB,
        tokenBadgeA: tokenBadgeA.publicKey,
        tokenBadgeB: tokenBadgeB.publicKey,
        tokenProgramA,
        tokenProgramB,
        tokenVaultAKeypair, // Keypair as expected
        tokenVaultBKeypair, // Keypair as expected
        feeTierKey: feeTierPda.publicKey,
        tickSpacing: TICK_SPACING,
        funder: wallet.publicKey,
      });
  
      // 9. Build transaction with all required signers
      console.log("🔍 Building transaction...");
      const tx = new Transaction();
      
      // Add all instructions
      tx.add(configIx.instructions[0]);
      tx.add(feeTierIx.instructions[0]);
      tx.add(poolIx.instructions[0]);
  
      // Set transaction parameters
      tx.feePayer = wallet.publicKey;
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
  
      // Sign and send transaction with all required signers
      const signers = [
        keypair,
        whirlpoolsConfigKeypair,
        tokenVaultAKeypair,
        tokenVaultBKeypair,
      ];
  
      console.log("Sending transaction...");
      const signature = await sendAndConfirmTransaction(
        connection, 
        tx, 
        signers,
        { commitment: 'confirmed' }
      );
  
      console.log('✅ Pool initialized!');
      console.log('Signature:', signature);
      console.log('Whirlpool:', whirlpoolPda.publicKey.toString());
      console.log('Token Vault A:', tokenVaultAKeypair.publicKey.toString());
      console.log('Token Vault B:', tokenVaultBKeypair.publicKey.toString());
  
    } catch (error) {
      console.error('❌ Error initializing pool:', error);
      
      // More detailed error logging
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      
      // Check for specific Anchor/Solana errors
      if (error && typeof error === 'object' && 'logs' in error) {
        console.error('Transaction logs:', (error as any).logs);
      }
    }
  }
  
  main().catch(console.error);