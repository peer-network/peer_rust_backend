use anchor_lang::prelude::*;


/// Error Code Structure:
/// - 6000-6099: Core token errors (mint, accounts, validation)
/// - 6100-6199: Transfer and fee errors
/// - 6200-6299: Daily mint and distribution errors  
/// - 6300-6399: Gems to token conversion errors
/// - 6400-6499: Authorization and permission errors
/// - 6500-6599: Mathematical and calculation errors
#[error_code]
pub enum PeerTokenError {
    // ═══════════════════════════════════════════════════════════
    // CORE TOKEN ERRORS (6000-6099)
    // ═══════════════════════════════════════════════════════════
    
    /// 6000 - Invalid token mint address provided
    #[msg("Invalid token mint address - ensure you're using the correct Peer Token mint")]
    InvalidMint,

    /// 6001 - Mint authority validation failed
    #[msg("Invalid mint authority - only authorized accounts can mint tokens")]
    InvalidMintAuthority,

    /// 6002 - Token account owner mismatch
    #[msg("Invalid token account owner - account doesn't belong to expected owner")]
    InvalidOwner,

    /// 6003 - Token account not properly initialized
    #[msg("Token account not initialized - account must be created before use")]
    InvalidTokenAccount,

    /// 6004 - Invalid token decimals configuration
    #[msg("Invalid token decimals - Peer Token must have exactly 9 decimals")]
    InvalidTokenDecimals,

    /// 6005 - Token metadata validation failed
    #[msg("Invalid token metadata - metadata doesn't match expected format")]
    InvalidTokenMetadata,

    /// 6006 - Metadata creation process failed
    #[msg("Metadata creation failed - unable to create token metadata")]
    MetadataCreationFailed,

    /// 6007 - Double Time Initialization 
    #[msg("Already Initialized Token Accounts")]
    AlreadyInitialized,

    // ═══════════════════════════════════════════════════════════
    // TRANSFER AND FEE ERRORS (6100-6199)
    // ═══════════════════════════════════════════════════════════

    /// 6100 - Transfer amount validation failed
    #[msg("Invalid transfer amount - amount must be greater than 0 and within limits")]
    InvalidTransferAmount,

    /// 6101 - Insufficient balance for transfer + fees
    #[msg("Insufficient Peer Token balance - need enough for transfer amount plus fees")]
    InsufficientPeerTokens,

    /// 6102 - Fee calculation resulted in invalid amount
    #[msg("Invalid fee calculation - calculated fees exceed maximum allowed")]
    InvalidFeeCalculation,

    /// 6103 - Company fee wallet validation failed
    #[msg("Invalid company fee wallet - must be authorized company account")]
    InvalidCompanyWallet,

    /// 6104 - Liquidity pool wallet validation failed
    #[msg("Invalid liquidity pool wallet - must be authorized LP account")]
    InvalidLiquidityPoolWallet,

    /// 6105 - Referral wallet validation failed
    #[msg("Invalid referral wallet - must be valid referral account")]
    InvalidReferralWallet,

    /// 6106 - Gas fee wallet validation failed
    #[msg("Invalid gas fee wallet - must be authorized fee collection account")]
    InvalidGasFeeWallet,

    /// 6107 - Burn amount calculation failed
    #[msg("Invalid burn amount - calculated burn amount is invalid")]
    InvalidBurnAmount,

    // ═══════════════════════════════════════════════════════════
    // DAILY MINT AND DISTRIBUTION ERRORS (6200-6299)
    // ═══════════════════════════════════════════════════════════

    /// 6200 - Daily mint limit already reached
    #[msg("Already minted today - daily mint of 5000 tokens already distributed")]
    AlreadyMintedToday,

    /// 6201 - Daily mint amount exceeds limit
    #[msg("Daily mint limit exceeded - cannot mint more than 5000 tokens per day")]
    DailyMintLimitExceeded,

    /// 6202 - Distribution calculation failed
    #[msg("Distribution calculation failed - unable to calculate user allocation")]
    DistributionCalculationFailed,

    /// 6203 - Invalid distribution recipient
    #[msg("Invalid distribution recipient - user not eligible for daily distribution")]
    InvalidDistributionRecipient,

    /// 6204 - Distribution already claimed today
    #[msg("Distribution already claimed - user already received today's allocation")]
    DistributionAlreadyClaimed,

    /// 6205 - Insufficient mint supply for distribution
    #[msg("Insufficient mint supply - not enough tokens available for distribution")]
    InsufficientMintSupply,

    // ═══════════════════════════════════════════════════════════
    // GEMS TO TOKEN CONVERSION ERRORS (6300-6399)
    // ═══════════════════════════════════════════════════════════

    /// 6300 - Invalid gems amount for conversion
    #[msg("Invalid gems amount - gems amount must be greater than 0")]
    InvalidGemsAmount,

    /// 6301 - Insufficient gems balance for conversion
    #[msg("Insufficient gems balance - not enough gems for requested conversion")]
    InsufficientGems,

    /// 6302 - Gems to token conversion rate invalid
    #[msg("Invalid conversion rate - gems to token conversion rate is invalid")]
    InvalidConversionRate,

    /// 6303 - Conversion amount calculation failed
    #[msg("Conversion calculation failed - unable to calculate token amount from gems")]
    ConversionCalculationFailed,

    /// 6304 - Daily conversion limit exceeded
    #[msg("Daily conversion limit exceeded - maximum gems conversion reached for today")]
    DailyConversionLimitExceeded,

    /// 6305 - Gems conversion not available
    #[msg("Gems conversion unavailable - conversion is temporarily disabled")]
    ConversionNotAvailable,

    // ═══════════════════════════════════════════════════════════
    // AUTHORIZATION AND PERMISSION ERRORS (6400-6499)
    // ═══════════════════════════════════════════════════════════

    /// 6400 - Unauthorized operation attempted
    #[msg("Unauthorized operation - account doesn't have permission for this action")]
    UnauthorizedOperation,

    /// 6401 - Invalid signer for operation
    #[msg("Unauthorized signer - signer is not authorized for this operation")]
    UnauthorizedSigner,

    /// 6402 - Token account authorization failed
    #[msg("Unauthorized token account - account is not authorized for this operation")]
    UnauthorizedTokenAccount,

    /// 6403 - Admin privileges required
    #[msg("Admin privileges required - only admin accounts can perform this action")]
    AdminPrivilegesRequired,

    /// 6404 - Invalid authority account
    #[msg("Invalid authority - provided authority account is not valid")]
    InvalidAuthority,

    /// 6405 - Invalid recipient account
    #[msg("Invalid recipient - provided recipient account is not valid")]
    InvalidRecipient,

    // ═══════════════════════════════════════════════════════════
    // MATHEMATICAL AND CALCULATION ERRORS (6500-6599)
    // ═══════════════════════════════════════════════════════════

    /// 6500 - Arithmetic overflow occurred
    #[msg("Arithmetic overflow - calculation result exceeds maximum value")]
    ArithmeticOverflow,

    /// 6501 - Arithmetic underflow occurred
    #[msg("Arithmetic underflow - calculation result is below minimum value")]
    ArithmeticUnderflow,

    /// 6502 - Division by zero attempted
    #[msg("Division by zero - cannot divide by zero")]
    DivisionByZero,

    /// 6503 - Invalid percentage value
    #[msg("Invalid percentage - percentage must be between 0 and 100")]
    InvalidPercentage,

    /// 6504 - Amount validation failed
    #[msg("Invalid amount - amount must be within valid range")]
    InvalidAmount,

    /// 6505 - Precision loss in calculation
    #[msg("Precision loss - calculation would result in significant precision loss")]
    PrecisionLoss,
}

// ═══════════════════════════════════════════════════════════
// ERROR CONVERSION IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════

/// Converts PeerTokenError to Solana's native ProgramError
/// This allows automatic error conversion throughout the program
impl From<PeerTokenError> for ProgramError {
    fn from(e: PeerTokenError) -> Self {
        ProgramError::Custom(e as u32)
    }
}