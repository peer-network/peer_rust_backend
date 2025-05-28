import { openFullRangePosition, setPayerFromBytes, setRpc, setWhirlpoolsConfig } from '@orca-so/whirlpools';
import { createSolanaRpc, devnet, address } from '@solana/kit';
import { getKeypairFromEnvPath } from '../../utilss';

async function main() {
  // Set up Whirlpool config for devnet
  await setWhirlpoolsConfig('solanaDevnet');
  await setRpc('https://api.devnet.solana.com');

  // RPC connection to devnet
  const devnetRpc = createSolanaRpc(devnet('https://api.devnet.solana.com'));

  // Load wallet (should return a Keypair or WalletAdapter-compatible object)
  const keypair = getKeypairFromEnvPath("COMPANY_WALLET_PATH");
  const signer = await setPayerFromBytes(new Uint8Array(keypair.secretKey));


  // Whirlpool address (e.g., SOL/devUSDC on devnet)
  const whirlpoolAddress = address("Ev6nbffpMhogRNyFRcV8XWPivkjrXrjkT44cmbXsvVKK");


  const decimals = 9;
  const baseUnit = BigInt(Math.pow(10, decimals));

  const amount = BigInt(1000); // 1000 tokens
  // Parameters for LP: specify token A amount (in raw units, e.g., 10 SOL = 10e9)
  const param = {
    tokenA: amount * baseUnit
  };

  // Open full range position
  const {
    quote,
    instructions,
    initializationCost,
    positionMint,
    callback: sendTx,
  } = await openFullRangePosition(whirlpoolAddress, param, 100); // 100 bps = 1% slippage

  // Send the transaction to the blockchain
  const txId = await sendTx();

  // Logging
  console.log(`Quote token max B: ${quote.tokenMaxB}`);
  console.log(`Initialization cost: ${initializationCost}`);
  console.log(`Position mint: ${positionMint}`);
  console.log(`Transaction ID: ${txId}`);
}

main().catch(console.error);
