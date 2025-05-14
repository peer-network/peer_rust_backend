use anchor_lang::error_code;
use anchor_lang::prelude::*;
use solana_program::program_error::ProgramError;

/// Error codes specific to the Peer Token program
/// Starting at the standard offset of 6000 for user-defined errors
#[error_code(offset = 6000)]
pub enum PeerTokenError {
    /// 6000 - Invalid authority to perform this operation
    #[msg("Invalid authority to perform this operation")]
    InvalidAuthority,

    /// 6001 - Invalid token mint address
    #[msg("Invalid token mint address")]
    InvalidMint,

    /// 6002 - Invalid token account
    #[msg("Invalid token account")]
    InvalidTokenAccount,

    /// 6003 - Insufficient token balance
    #[msg("Insufficient token balance")]
    InsufficientPeerTokens,

    /// 6004 - Maximum daily mint limit exceeded
    #[msg("Maximum daily mint limit exceeded")]
    DailyMintLimitExceeded,

    /// 6005 - Too early for next daily mint
    #[msg("Too early for next daily mint")]
    TooEarlyForDailyMint,

    /// 6006 - Invalid transfer amount
    #[msg("Invalid transfer amount")]
    InvalidTransferAmount,

    /// 6007 - Metadata creation failed
    #[msg("Metadata creation failed")]
    MetadataCreationFailed,

    /// 6008 - Unauthorized token transfer
    #[msg("Unauthorized token transfer")]
    UnauthorizedTransfer,

    /// 6009 - Invalid token decimals
    #[msg("Invalid token decimals")]
    InvalidTokenDecimals,

    /// 6010 - Invalid token metadata
    #[msg("Invalid token metadata")]
    InvalidTokenMetadata,

    /// 6011 - Invalid token account owner
    #[msg("Invalid token account owner")]
    InvalidOwner,

    /// 6012 - Invalid token account initialization
    #[msg("Invalid token account initialization")]
    InvalidTokenAccountInit,

    /// 6013 - Invalid metadata account
    #[msg("Invalid metadata account")]
    InvalidMetadataAccount,

    /// 6014 - Invalid mint authority
    #[msg("Invalid mint authority")]
    InvalidMintAuthority,

    /// 6015 - Invalid freeze authority
    #[msg("Invalid freeze authority")]
    InvalidFreezeAuthority,

    /// 6016 - Invalid associated token account
    #[msg("Invalid associated token account")]
    InvalidAssociatedTokenAccount,
    
    /// 6017 - Already minted tokens today
    #[msg("Tokens have already been minted today")]
    AlreadyMintedToday,
    
    /// 6018 - Invalid peer token account
    #[msg("Invalid peer token account")]
    InvalidPeerTokenAccount,
    
    /// 6019 - Insufficient amount
    #[msg("Cannot transfer zero or insufficient amount")]
    InsufficientAmount,
}

impl From<PeerTokenError> for ProgramError {
    fn from(e: PeerTokenError) -> Self {
        ProgramError::Custom(e as u32)
    }
}

/// Macro to require a condition to be true, otherwise return an error
#[macro_export]
macro_rules! require_peer {
    ($cond:expr, $err:expr) => {
        if !($cond) {
            return Err($err.into());
        }
    };
}

/// Macro to validate equality between two values, otherwise return an error
#[macro_export]
macro_rules! require_eq_peer {
    ($left:expr, $right:expr, $err:expr) => {
        if ($left) != ($right) {
            return Err($err.into());
        }
    };
}

/// Macro to validate key equality, otherwise return an error
#[macro_export]
macro_rules! require_keys_eq_peer {
    ($left:expr, $right:expr, $err:expr) => {
        if ($left) != ($right) {
            return Err($err.into());
        }
    };
} 