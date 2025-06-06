use anchor_lang::error_code;
use anchor_lang::solana_program::program_error::ProgramError;

/// Error codes specific to the Peer Token program
/// Starting at the standard offset of 6000 for user-defined errors
#[error_code(offset = 6000)]
pub enum PeerTokenError {
    /// 6000 - Invalid token mint address
    #[msg("Invalid token mint address")]
    InvalidMint,

    /// 6001 - Invalid mint authority
    #[msg("Invalid mint authority")]
    InvalidMintAuthority,

    /// 6002 - Invalid token account owner
    #[msg("Invalid token account owner")]
    InvalidOwner,

    /// 6003 - Invalid transfer amount
    #[msg("Invalid transfer amount")]
    InvalidTransferAmount,

    /// 6004 - Insufficient token balance
    #[msg("Insufficient token balance")]
    InsufficientPeerTokens,

    /// 6005 - Invalid token decimals
    #[msg("Invalid token decimals")]
    InvalidTokenDecimals,

    /// 6006 - Invalid token metadata
    #[msg("Invalid token metadata")]
    InvalidTokenMetadata,

    /// 6007 - Metadata creation failed
    #[msg("Metadata creation failed")]
    MetadataCreationFailed,
}

impl From<PeerTokenError> for ProgramError {
    fn from(e: PeerTokenError) -> Self {
        ProgramError::Custom(e as u32)
    }
}