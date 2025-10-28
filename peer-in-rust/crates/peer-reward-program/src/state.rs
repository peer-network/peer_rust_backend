use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

/// Vault state - stores reward vault configuration
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct RewardVault {
    /// Authority that can manage the vault (company wallet)
    pub authority: Pubkey,
    /// Token mint address
    pub token_mint: Pubkey,
    /// Total rewards deposited
    pub total_deposited: u64,
    /// Total rewards claimed by users
    pub total_claimed: u64,
    /// Backend authority pubkey (for signature verification)
    pub backend_authority: Pubkey,
    /// Bump seed for PDA
    pub bump: u8,
}

impl RewardVault {
    pub const LEN: usize = 32 + 32 + 8 + 8 + 32 + 1; // 113 bytes
}

/// Claim record - tracks if a user has claimed (prevents double-claiming)
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct ClaimRecord {
    /// User who claimed
    pub user: Pubkey,
    /// Amount claimed
    pub amount: u64,
    /// Timestamp when claimed
    pub claimed_at: i64,
    /// Bump seed for PDA
    pub bump: u8,
}

impl ClaimRecord {
    pub const LEN: usize = 32 + 8 + 8 + 1; // 49 bytes
}

/// PDA seed prefixes
pub const VAULT_SEED: &[u8] = b"reward_vault";
pub const CLAIM_SEED: &[u8] = b"claim_record";
