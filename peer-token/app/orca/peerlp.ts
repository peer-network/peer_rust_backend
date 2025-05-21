// import { PublicKey } from "@metaplex-foundation/js";
// import { Orca } from "@orca-so/sdk";

// import { setWhirlpoolsConfig } from "@orca-so/whirlpools";


//  import { getKeypairFromEnvPath } from "../../utilss";

// import { setDefaultFunder } from "@orca-so/whirlpools";




//  import { createKeyPairSignerFromBytes } from '@solana/kit';
//  import fs from 'fs';



// console.log(wallet);

// async function main() {
// // 1.Wallet Config 
//  const keypair = getKeypairFromEnvPath("COMPANY_WALLET_PATH");

//  const wallet =  await createKeyPairSignerFromBytes(keypair.secretKey);



// await setWhirlpoolsConfig("solanaDevnet");


// await setDefaultFunder(wallet);



// }

// main();

import { createSplashPool, setWhirlpoolsConfig, setRpc, setPayerFromBytes } from '@orca-so/whirlpools';
import { generateKeyPairSigner, createSolanaRpc, devnet, address, getConstantCodec } from '@solana/kit';
import { getKeypairFromEnvPath } from "../../utilss";
import { getSolanaConnection } from "../../utilss";
import { Connection } from '@solana/web3.js';

async function main() {
const keypair = getKeypairFromEnvPath("COMPANY_WALLET_PATH");
await setWhirlpoolsConfig('solanaDevnet');
await setRpc('https://api.devnet.solana.com');
// const signer = await setPayerFromBytes(new Uint8Array(keypair.secretKey));

const tokenMintOne = address("28Bv436Y6HNVmnHVpRYuXH7efuqsvBRKpsgoz4WHNgKB");
const tokenMintTwo = address("Wbtc28Bv436Y6HNVmnHVpRYuXH7efuqsvBRKpsgoz4WHNgKB"); // Wbtc
const initialPrice = 0.01;
const connection = getSolanaConnection();

const { poolAddress, instructions, initializationCost, callback: sendTx } = await createSplashPool(
    tokenMintOne,
    tokenMintTwo,
    // initialPrice,
    // secretKey: keypair.secretKey
);

// Use the callback to submit the transaction
const txId = await sendTx();

console.log(`Pool Address: ${poolAddress}`);
console.log(`Initialization Cost: ${initializationCost} lamports`);
console.log(`Transaction ID: ${txId}`);
}

main();