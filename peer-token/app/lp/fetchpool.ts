import { fetchSplashPool, setWhirlpoolsConfig } from '@orca-so/whirlpools';
import { createSolanaRpc, devnet, address } from '@solana/kit';

async function main() {
await setWhirlpoolsConfig('solanaDevnet');
const devnetRpc = createSolanaRpc(devnet('https://api.devnet.solana.com'));
const tokenMintOne = address("AkQwr5mHtAveaaCRGMJbrmBHLhxuUcKx6B3MpB95huxi");
const tokenMintTwo = address("6vqALHHTP6NkMgzCJzaLDiwJLFGrBqM7kxMBj66EG2GB"); // USDC (devnet)

const poolInfo = await fetchSplashPool(
  devnetRpc,
  tokenMintOne,
  tokenMintTwo
);


if (poolInfo.initialized) {
  console.log("Pool is initialized:", poolInfo);
} else {
  console.log("Pool is not initialized:", poolInfo);
};
}

main();