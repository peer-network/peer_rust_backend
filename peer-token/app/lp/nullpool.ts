import {
    decreaseLiquidity,
    setPayerFromBytes,
    setWhirlpoolsConfig,
  } from '@orca-so/whirlpools';
  import { address, createSolanaRpc, devnet } from '@solana/kit';
  import { getKeypairFromEnvPath } from '../../utilss';
  import { PublicKey, Transaction } from '@solana/web3.js';
  import { sendTransaction, setRpc } from '@orca-so/tx-sender';
  
  async function main() {

    await setRpc('https://api.devnet.solana.com');
    await setWhirlpoolsConfig('solanaDevnet');

    const devnetRpc = createSolanaRpc(devnet('https://api.devnet.solana.com'));

    const keypair = getKeypairFromEnvPath("COMPANY_WALLET_PATH");
    const signer = await setPayerFromBytes(new Uint8Array(keypair.secretKey));
  
    const positionMintAddress = address('23Je5YSuebuqrpckZoudWrqiiCpSHMpuM834JSQxKBRU');

    // const decimals = 9;
    // const baseUnit = BigInt(Math.pow(10, decimals));
    const currentLiquidity = BigInt(1000000000); // replace with actual liquidity
  
    if (currentLiquidity === BigInt(0)) {
      console.log('No liquidity to withdraw. Pool already empty.');
      return;
    }
  
    const param = { liquidity: currentLiquidity };
  
    const { instructions, quote, callback: sendTx} = await decreaseLiquidity(
      positionMintAddress,
      param,
      100,
    );
  
    const txId = await sendTx();
  
    console.log('Liquidity removed from position:', currentLiquidity.toString());
    console.log('Tokens returned (max):', quote.tokenMinA.toString(), 'tokenA');
    console.log('Tokens returned (max):', quote.tokenMinB.toString(), 'tokenB');
    console.log('Transaction ID:', txId);
  }

  main();
  