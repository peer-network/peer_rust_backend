import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { Keypair, PublicKey, Connection, clusterApiUrl } from "@solana/web3.js";

// Load .env once from project root
dotenv.config({ path: path.resolve(__dirname, ".env") });

/**
 * Get a required env variable
 */
export function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`❌ Missing environment variable: ${key}`);
  return value;
}

export function getTokenDecimals(key: string): number {
  const value = getEnv(key);
  return Number(value);
}

export function getDailyMintAmount(key: string): number {
  const value = getEnv(key);
  return Number(value);
}

/**
 * Get a Solana PublicKey from an env variable
 */
export function getPublicKey(envKey: string): PublicKey {
  return new PublicKey(getEnv(envKey));
}

/**
 * Get a Solana Keypair from a wallet file path in an env variable
 */
export function getKeypairFromEnvPath(envKey: string): Keypair {
  const relativePath = getEnv(envKey);
  const fullPath = path.resolve(__dirname, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`❌ Wallet file not found: ${fullPath}`);
  }

  const secret = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
  return Keypair.fromSecretKey(Buffer.from(secret));
}

/**
 * Get the Solana connection based on .env config
 */
export function getSolanaConnection(): Connection {
  const customRpc = process.env.RPC_ENDPOINT;
  const network = process.env.SOLANA_NETWORK || "devnet";
  const rpcUrl = customRpc || clusterApiUrl(network as any);
  return new Connection(rpcUrl, "confirmed");
}

/**
 * Get the IDL JSON object from the IDL_PATH
 */
export function getIdl(): any {
  const idlPath = path.resolve(__dirname, getEnv("IDL_PATH"));
  if (!fs.existsSync(idlPath)) {
    throw new Error(`❌ IDL file not found at: ${idlPath}`);
  }
  return JSON.parse(fs.readFileSync(idlPath, "utf8"));
}
