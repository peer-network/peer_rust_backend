import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { Keypair, PublicKey, Connection, clusterApiUrl } from "@solana/web3.js";
import { ErrorFactory, ErrorCode, PeerTokenError } from "./app/errors/ErrorHandler";

// Load .env once from project root
dotenv.config({ path: path.resolve(__dirname, ".env") });

/**
 * Get a required env variable
 */
export function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new PeerTokenError(
    ErrorCode.ENVIRONMENT_ERROR, 
    `Missing environment variable: ${key}`,
    { key }
  );
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
  try {
    return new PublicKey(getEnv(envKey));
  } catch (error) {
    throw new PeerTokenError(
      ErrorCode.INVALID_PARAMETER,
      `Invalid public key in environment variable: ${envKey}`,
      { envKey, originalError: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Get a Solana Keypair from a wallet file path in an env variable
 */
export function getKeypairFromEnvPath(envKey: string): Keypair {
  try {
    const relativePath = getEnv(envKey);
    const fullPath = path.resolve(__dirname, relativePath);
    if (!fs.existsSync(fullPath)) {
      throw ErrorFactory.walletNotFound(fullPath);
    }

    const secret = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
    return Keypair.fromSecretKey(Buffer.from(secret));
  } catch (error) {
    if (error instanceof PeerTokenError) throw error;
    
    throw new PeerTokenError(
      ErrorCode.INVALID_KEYPAIR,
      `Failed to load keypair from env path: ${envKey}`,
      { envKey, originalError: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Get the Solana connection based on .env config
 */
export function getSolanaConnection(): Connection {
  try {
    const customRpc = process.env.RPC_ENDPOINT;
    const network = process.env.SOLANA_NETWORK || "devnet";
    const rpcUrl = customRpc || clusterApiUrl(network as any);
    return new Connection(rpcUrl, "confirmed");
  } catch (error) {
    throw ErrorFactory.connectionFailed(
      `Failed to establish Solana connection`,
      { originalError: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Get the IDL JSON object from the IDL_PATH
 */
export function getIdl(): any {
  try {
    const idlPath = path.resolve(__dirname, getEnv("IDL_PATH"));
    if (!fs.existsSync(idlPath)) {
      throw new PeerTokenError(
        ErrorCode.FILE_NOT_FOUND,
        `IDL file not found at: ${idlPath}`,
        { idlPath }
      );
    }
    return JSON.parse(fs.readFileSync(idlPath, "utf8"));
  } catch (error) {
    if (error instanceof PeerTokenError) throw error;
    
    if (error instanceof SyntaxError) {
      throw ErrorFactory.invalidJson(error);
    }
    
    throw new PeerTokenError(
      ErrorCode.CONFIGURATION_ERROR,
      `Failed to load IDL file`,
      { originalError: error instanceof Error ? error.message : String(error) }
    );
  }
}
