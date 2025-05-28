import { setPayerFromBytes, setWhirlpoolsConfig, swap } from '@orca-so/whirlpools';
import { address } from '@solana/kit';
import { getKeypairFromEnvPath } from '../../utilss';
import { setRpc } from '@orca-so/tx-sender';

async function main() {
await setWhirlpoolsConfig('solanaDevnet');
await setRpc('https://api.devnet.solana.com');
const keypair = getKeypairFromEnvPath("COMPANY_WALLET_PATH");
const signer = await setPayerFromBytes(new Uint8Array(keypair.secretKey));
const whirlpoolAddress = address("Ev6nbffpMhogRNyFRcV8XWPivkjrXrjkT44cmbXsvVKK");
const mintAddress = address("23Je5YSuebuqrpckZoudWrqiiCpSHMpuM834JSQxKBRU");
const inputAmount = BigInt(1000000000000000000);

const { instructions, quote, callback: sendTx } = await swap(
  { inputAmount, mint: mintAddress },
  whirlpoolAddress,
  100,
);

// Use the callback to submit the transaction
const txId = await sendTx();

console.log(`Quote estimated token out: ${quote.tokenEstOut}`);
console.log(`Number of instructions:, ${instructions.length}`);
console.log(`Transaction ID: ${txId}`);
}

main();