// use anchor_lang::prelude::*;




// seeds
pub const CONFIG_SEED: &[u8] = b"peer-config";  // For ProgramConfig PDA
pub const MINT_SEED: &[u8] = b"peer-mint";     // For mint account PDA
pub const TREASURY_SEED: &[u8] = b"peer-treasury"; // For Company ATA
pub const TOKEN_STATE: &[u8] = b"peer-token-state";  // Unique identifier for our token state PDA
pub const DAILY_MINT: &[u8] = b"daily-mint-record";  // For daily mint tracking
pub const FEE_WALLET_SEED: &[u8] = b"peer-fee-wallet";
pub const MINTING_VAULT_SEED: &[u8] = b"peer-minting-vault";


// Token defaults
pub const TOKEN_DECIMALS: u8 = 9;
pub const TOKEN_NAME: &str = "Peer Token";
pub const TOKEN_SYMBOL: &str = "PEER";
pub const DAILY_MINT_AMOUNT: u64 = 5_000 * 1_000_000_000; // 5000 tokens with 9 decimals

// Fee defaults (basis points)
pub const DEFAULT_BURN_PERCENT: u16 = 100;      // 1%
pub const DEFAULT_COMPANY_PERCENT: u16 = 200;   // 2%
pub const DEFAULT_LP_PERCENT: u16 = 100;        // 1%
pub const DEFAULT_REFERRAL_PERCENT: u16 = 100;  // 1%
pub const DEFAULT_GAS_FEE: u64 = 1_000_000_000; // 1.0 token with 9 decimals

//Program config limit

