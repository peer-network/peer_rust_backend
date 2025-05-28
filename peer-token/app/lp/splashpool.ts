import { createSplashPool, setWhirlpoolsConfig, setRpc, setPayerFromBytes, } from '@orca-so/whirlpools';
import { generateKeyPairSigner, createSolanaRpc, devnet, address, getConstantCodec, getAddressEncoder } from '@solana/kit';
import { getKeypairFromEnvPath } from "../../utilss";
import { getSolanaConnection } from "../../utilss";
import { Connection } from '@solana/web3.js';




async function main() {


  const keypair = getKeypairFromEnvPath("COMPANY_WALLET_PATH");
  await setWhirlpoolsConfig('solanaDevnet');
  await setRpc('https://api.devnet.solana.com');
  const signer = await setPayerFromBytes(new Uint8Array(keypair.secretKey));

  // Check token mint info of the both tokens 

  
  const tokenMintOne = address("AkQwr5mHtAveaaCRGMJbrmBHLhxuUcKx6B3MpB95huxi");
  const tokenMintTwo = address("6vqALHHTP6NkMgzCJzaLDiwJLFGrBqM7kxMBj66EG2GB"); // USDC (devnet)
  const initialPrice = 0.01;
  const connection = getSolanaConnection();

  // Use proper base58 encoding for address bytes comparison
  const encoder = getAddressEncoder();
  const mint1Bytes = new Uint8Array(encoder.encode(tokenMintOne));
  const mint2Bytes = new Uint8Array(encoder.encode(tokenMintTwo));

  const [orderedTokenA, orderedTokenB] =
    Buffer.compare(Buffer.from(mint1Bytes), Buffer.from(mint2Bytes)) < 0
      ? [tokenMintOne, tokenMintTwo]
      : [tokenMintTwo, tokenMintOne];

 


  const { poolAddress, instructions, initializationCost, callback: sendTx } = await createSplashPool(
      orderedTokenA,
      orderedTokenB,
      initialPrice,
  );

  // Use the callback to submit the transaction
  const txId = await sendTx();

  console.log(`Pool Address: ${poolAddress}`);
  console.log(`Initialization Cost: ${initializationCost} lamports`);
  console.log(`Transaction I D: ${txId}`);
}

main();

