use anchor_lang::prelude::*;
use anchor_spl::{
    token::{Mint, Token, TokenAccount, Transfer, transfer},
    associated_token::AssociatedToken,
};

declare_id!("AyU7HfAP36feEsNTfAifzLxDcT7kCYPER6HxWeb7czmX");

/// Main program module for Peer Token Distribution
#[program]
pub mod peer_token {
    use super::*;

    /// Initialize the program
    /// This is a placeholder for future initialization logic
    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }

    /// Distribute tokens to multiple users based on their gem counts
    /// 
    /// # Arguments
    /// * `ctx` - The context of the request
    /// * `recipients` - Vector of recipient data (wallet and gems)
    /// * `total_gems` - The total number of gems across all recipients
    /// 
    /// # Returns
    /// * `Result<()>` - Result indicating success or error
    pub fn distribute_tokens(
        ctx: Context<DistributeTokens>,
        recipients: Vec<RecipientData>,
        total_gems: u64
    ) -> Result<()> {
        // Validate inputs
        require!(!recipients.is_empty(), ErrorCode::NoRecipients);
        require!(total_gems > 0, ErrorCode::InvalidGemCount);
        require!(recipients.len() <= 100, ErrorCode::TooManyRecipients);
        
        // Initialize distribution account
        let distribution_info = &mut ctx.accounts.distribution_info;
        distribution_info.authority = ctx.accounts.authority.key();
        distribution_info.mint = ctx.accounts.mint.key();
        distribution_info.total_recipients = recipients.len() as u16;
        distribution_info.total_gems = total_gems;
        distribution_info.distributed = false;
        distribution_info.timestamp = Clock::get()?.unix_timestamp;
        
        // Emit event for the distribution initialization
        emit!(DistributionInitEvent {
            total_recipients: recipients.len() as u16,
            total_gems,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }
    
    /// Execute a single transfer in the distribution
    /// 
    /// # Arguments
    /// * `ctx` - The context of the request
    /// * `user_gems` - The number of gems owned by the recipient
    /// 
    /// # Returns
    /// * `Result<()>` - Result indicating success or error
    pub fn execute_distribution(
        ctx: Context<ExecuteDistribution>,
        user_gems: u64
    ) -> Result<()> {
        // Validate inputs
        require!(user_gems > 0, ErrorCode::InvalidGemCount);
        
        // Get the total gems from the distribution info
        let distribution_info = &ctx.accounts.distribution_info;
        let total_gems = distribution_info.total_gems;
        
        // Ensure user_gems doesn't exceed total_gems
        require!(user_gems <= total_gems, ErrorCode::InvalidGemCount);
        
        // Calculate percentage: (user_gems / total_gems) * 100
        let percentage = calculate_percentage(user_gems, total_gems)?;
        
        // Calculate the token amount to transfer based on user's gem percentage
        let source_balance = ctx.accounts.source_token_account.amount;
        let transfer_amount = calculate_transfer_amount(source_balance, percentage)?;
            
        // Verify there are enough tokens to transfer
        require!(transfer_amount > 0, ErrorCode::InsufficientAmount);
        require!(
            transfer_amount <= source_balance,
            ErrorCode::InsufficientFunds
        );
        
        // Transfer tokens from source to destination
        let cpi_accounts = Transfer {
            from: ctx.accounts.source_token_account.to_account_info(),
            to: ctx.accounts.destination_token_account.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        
        transfer(cpi_ctx, transfer_amount)?;
        
        // Emit an event for this individual distribution
        emit!(DistributionEvent {
            recipient: ctx.accounts.destination_token_account.owner,
            amount: transfer_amount,
            gems: user_gems,
            percentage,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }
    
    /// Finalize the distribution and mark it as complete
    /// 
    /// # Arguments 
    /// * `ctx` - The context of the request
    /// 
    /// # Returns
    /// * `Result<()>` - Result indicating success or error
    pub fn finalize_distribution(ctx: Context<FinalizeDistribution>) -> Result<()> {
        // Mark the distribution as distributed
        let distribution_info = &mut ctx.accounts.distribution_info;
        distribution_info.distributed = true;
        
        // Emit completion event
        emit!(DistributionCompleteEvent {
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }
}

/// Initial program setup - placeholder for future initialization
#[derive(Accounts)]
pub struct Initialize {}

/// Accounts required for token distribution initialization
#[derive(Accounts)]
pub struct DistributeTokens<'info> {
    /// The mint of the token being distributed
    pub mint: Account<'info, Mint>,
    
    /// The source token account (company wallet)
    #[account(
        mut,
        constraint = source_token_account.mint == mint.key() @ ErrorCode::InvalidMint,
        constraint = source_token_account.owner == authority.key() @ ErrorCode::InvalidOwner,
    )]
    pub source_token_account: Account<'info, TokenAccount>,
    
    /// The authority (signer) that owns the source token account
    #[account(mut)]
    pub authority: Signer<'info>,
    
    /// Account to store information about this distribution
    #[account(
        init,
        payer = authority,
        space = DistributionInfo::LEN
    )]
    pub distribution_info: Account<'info, DistributionInfo>,
    
    /// Programs
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

/// Accounts required for executing a single token distribution
#[derive(Accounts)]
pub struct ExecuteDistribution<'info> {
    /// The mint of the token being distributed
    pub mint: Account<'info, Mint>,
    
    /// The source token account (company wallet)
    #[account(
        mut,
        constraint = source_token_account.mint == mint.key() @ ErrorCode::InvalidMint,
        constraint = source_token_account.owner == authority.key() @ ErrorCode::InvalidOwner,
    )]
    pub source_token_account: Account<'info, TokenAccount>,
    
    /// The destination token account (recipient's wallet)
    #[account(
        mut,
        constraint = destination_token_account.mint == mint.key() @ ErrorCode::InvalidMint,
    )]
    pub destination_token_account: Account<'info, TokenAccount>,
    
    /// The authority (signer) that owns the source token account
    #[account(mut)]
    pub authority: Signer<'info>,
    
    /// Reference to the distribution information
    #[account(
        constraint = distribution_info.authority == authority.key() @ ErrorCode::InvalidAuthority,
        constraint = distribution_info.mint == mint.key() @ ErrorCode::InvalidMint,
        constraint = distribution_info.distributed == false @ ErrorCode::DistributionAlreadyFinalized,
    )]
    pub distribution_info: Account<'info, DistributionInfo>,
    
    /// Programs
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// Accounts required for finalizing a distribution
#[derive(Accounts)]
pub struct FinalizeDistribution<'info> {
    /// The authority (signer) that owns the source token account
    #[account(mut)]
    pub authority: Signer<'info>,
    
    /// Reference to the distribution information
    #[account(
        mut,
        constraint = distribution_info.authority == authority.key() @ ErrorCode::InvalidAuthority,
        constraint = distribution_info.distributed == false @ ErrorCode::DistributionAlreadyFinalized,
    )]
    pub distribution_info: Account<'info, DistributionInfo>,
    
    /// System program
    pub system_program: Program<'info, System>,
}

/// Account to store information about a token distribution
#[account]
pub struct DistributionInfo {
    /// Authority that created the distribution
    pub authority: Pubkey,
    /// Token mint address
    pub mint: Pubkey,
    /// Total number of recipients
    pub total_recipients: u16,
    /// Total number of gems across all recipients
    pub total_gems: u64,
    /// Whether the distribution has been finalized
    pub distributed: bool,
    /// Creation timestamp
    pub timestamp: i64,
}

impl DistributionInfo {
    pub const LEN: usize = 8 +  // discriminator
                          32 +  // authority pubkey
                          32 +  // mint pubkey
                           2 +  // total_recipients
                           8 +  // total_gems
                           1 +  // distributed (boolean)
                           8;   // timestamp
}

/// Struct to define recipient data
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RecipientData {
    /// Recipient's wallet address
    pub wallet: Pubkey,
    /// Number of gems owned by recipient
    pub gems: u64,
}

/// Event emitted on distribution initialization
#[event]
pub struct DistributionInitEvent {
    /// Total number of recipients
    pub total_recipients: u16,
    /// Total number of gems across all recipients
    pub total_gems: u64,
    /// Creation timestamp
    pub timestamp: i64,
}

/// Event emitted on each individual distribution
#[event]
pub struct DistributionEvent {
    /// Recipient wallet address
    pub recipient: Pubkey,
    /// Amount of tokens transferred
    pub amount: u64,
    /// Number of gems owned by recipient
    pub gems: u64,
    /// Percentage of total tokens received (0-100)
    pub percentage: u8,
    /// Timestamp when distributed
    pub timestamp: i64,
}

/// Event emitted when distribution is completed
#[event]
pub struct DistributionCompleteEvent {
    /// Timestamp when finalized
    pub timestamp: i64,
}

/// Calculate percentage with proper error handling
/// Formula: (part / total) * 100
fn calculate_percentage(part: u64, total: u64) -> Result<u8> {
    if total == 0 {
        return Err(error!(ErrorCode::DivisionByZero));
    }

    // Use u128 for intermediate calculation to prevent overflow
    let percentage = (part as u128)
        .checked_mul(100)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(total as u128)
        .ok_or(ErrorCode::DivisionByZero)?;
    
    // Ensure percentage fits in u8 (0-255)
    if percentage > 255 {
        return Err(error!(ErrorCode::InvalidPercentage));
    }
    
    Ok(percentage as u8)
}

/// Calculate transfer amount with proper error handling
/// Formula: (balance * percentage) / 100
fn calculate_transfer_amount(balance: u64, percentage: u8) -> Result<u64> {
    (balance as u128)
        .checked_mul(percentage as u128)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(100)
        .ok_or(ErrorCode::DivisionByZero)
        .map(|result| result as u64)
        .map_err(|e| error!(e))
}

/// Custom errors with descriptive messages
#[error_code]
pub enum ErrorCode {
    #[msg("Cannot transfer zero or insufficient amount")]
    InsufficientAmount,
    
    #[msg("Insufficient funds in source account")]
    InsufficientFunds,
    
    #[msg("No recipients provided for distribution")]
    NoRecipients,
    
    #[msg("Invalid gem count")]
    InvalidGemCount,
    
    #[msg("Math operation resulted in overflow")]
    MathOverflow,
    
    #[msg("Division by zero attempted")]
    DivisionByZero,
    
    #[msg("Invalid percentage value")]
    InvalidPercentage,
    
    #[msg("Invalid mint account")]
    InvalidMint,
    
    #[msg("Invalid token account owner")]
    InvalidOwner,
    
    #[msg("Invalid authority for this operation")]
    InvalidAuthority,
    
    #[msg("Distribution already finalized")]
    DistributionAlreadyFinalized,
    
    #[msg("Too many recipients in single distribution")]
    TooManyRecipients,
}