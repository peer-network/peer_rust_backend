use solana_program::program_error::ProgramError;
use thiserror::Error;

#[derive(Error, Debug, Copy, Clone)]
pub enum RewardError {
    #[error("Invalid instruction")]
    InvalidInstruction,

    #[error("Invalid authority signature")]
    InvalidAuthority,

    #[error("Reward vault not initialized")]
    VaultNotInitialized,

    #[error("Insufficient reward balance")]
    InsufficientBalance,

    #[error("Invalid backend signature")]
    InvalidBackendSignature,

    #[error("Reward already claimed")]
    AlreadyClaimed,

    #[error("Invalid reward amount")]
    InvalidAmount,

    #[error("Claim expired")]
    ClaimExpired,
}

impl From<RewardError> for ProgramError {
    fn from(e: RewardError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
