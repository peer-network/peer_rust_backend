use anchor_lang::prelude::*;
use anchor_spl::{
    token::{Mint, Token, TokenAccount, Transfer, transfer},
    associated_token::AssociatedToken,
};

/// Struct to define recipient data
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RecipientData {
    /// Recipient's wallet address
    pub wallet: Pubkey,
    /// Number of tokens to transfer to this recipient
    pub token_amount: u64,
}

/// Handler for transferring tokens to a recipient
pub fn transfer_tokens_handler(
    ctx: Context<TransferTokens>,
    amount: u64
) -> Result<()> {
    // Validate inputs
    require!(amount > 0, ErrorCode::InsufficientAmount);
    
    // Verify there are enough tokens to transfer
    let source_balance = ctx.accounts.source_token_account.amount;
    require!(
        amount <= source_balance,
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
    
    transfer(cpi_ctx, amount)?;
    
    // Get recipient's key for the event
    let recipient_key = ctx.accounts.recipient.key();
    
    // Emit an event for this individual transfer
    emit!(TransferEvent {
        recipient: recipient_key,
        amount,
        timestamp: Clock::get()?.unix_timestamp,
    });
    
    Ok(())
}

/// Simple initialization struct - just emits an event
pub fn initialize_handler(ctx: Context<Initialize>) -> Result<()> {
    emit!(InitEvent {
        authority: ctx.accounts.authority.key(),
        timestamp: Clock::get()?.unix_timestamp,
    });
    Ok(())
}

/// Simple initialization struct
#[derive(Accounts)]
pub struct Initialize<'info> {
    /// The authority (signer) that will perform transfers
    #[account(mut)]
    pub authority: Signer<'info>,
    
    /// System program
    pub system_program: Program<'info, System>,
}

/// Accounts required for token transfer
#[derive(Accounts)]
pub struct TransferTokens<'info> {
    /// The mint of the token being transferred
    pub mint: Account<'info, Mint>,
    
    /// The source token account (company wallet)
    #[account(
        mut,
        constraint = source_token_account.mint == mint.key() @ ErrorCode::InvalidMint,
        constraint = source_token_account.owner == authority.key() @ ErrorCode::InvalidOwner,
    )]
    pub source_token_account: Account<'info, TokenAccount>,
    
    /// The destination token account (recipient's wallet)
    /// This account must exist and be initialized (client's responsibility)
    #[account(
        mut,
        constraint = destination_token_account.mint == mint.key() @ ErrorCode::InvalidMint,
    )]
    pub destination_token_account: Account<'info, TokenAccount>,
    
    /// The owner of the destination token account (for event emission)
    /// CHECK: We only use this for event emission
    pub recipient: UncheckedAccount<'info>,
    
    /// The authority (signer) that owns the source token account
    #[account(mut)]
    pub authority: Signer<'info>,
    
    /// Programs
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// Event emitted on initialization
#[event]
pub struct InitEvent {
    /// Authority that will be distributing tokens
    pub authority: Pubkey,
    /// Creation timestamp
    pub timestamp: i64,
}

/// Event emitted on each individual transfer
#[event]
pub struct TransferEvent {
    /// Recipient wallet address
    pub recipient: Pubkey,
    /// Amount of tokens transferred
    pub amount: u64,
    /// Timestamp when transferred
    pub timestamp: i64,
}

/// Custom errors with descriptive messages
#[error_code]
pub enum ErrorCode {
    #[msg("Cannot transfer zero or insufficient amount")]
    InsufficientAmount,
    
    #[msg("Insufficient funds in source account")]
    InsufficientFunds,
    
    #[msg("Invalid mint account")]
    InvalidMint,
    
    #[msg("Invalid token account owner")]
    InvalidOwner,
}