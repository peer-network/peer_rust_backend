use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface};
use anchor_spl::token_2022::MintTo;
use chrono::{DateTime, Utc};

pub fn handler(ctx: Context<DailyMintArgs>, amount: u64) -> Result<()> {
    // Get current time
    let current_time = Clock::get()?.unix_timestamp;
    
    // Get current date components
    let current_date = DateTime::<Utc>::from_timestamp(current_time, 0)
        .unwrap()
        .date_naive();
    
    // Get last mint date components
    let last_mint_time = ctx.accounts.last_mint.last_mint_timestamp;
    let last_mint_date = DateTime::<Utc>::from_timestamp(last_mint_time, 0)
        .unwrap()
        .date_naive();

    // Check if we've already minted today
    require!(
        last_mint_date < current_date,
        DailyMintError::AlreadyMintedToday
    );

    // Update last mint timestamp
    ctx.accounts.last_mint.last_mint_timestamp = current_time;

    // Create mint_to context
    let mint_to_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        MintTo {
            mint: ctx.accounts.peer_mint.to_account_info(),
            to: ctx.accounts.peer_token_account.to_account_info(),
            authority: ctx.accounts.peer_authority.to_account_info(),
        }
    );

    // Mint tokens
    token_interface::mint_to(mint_to_ctx, amount)?;
    
    msg!("Daily minted {} tokens to {}", amount, ctx.accounts.peer_token_account.key());
    Ok(())
}

/// Context for minting tokens
#[derive(Accounts)]
pub struct DailyMintArgs<'info> {
    /// The token mint
    #[account(mut)]
    pub peer_mint: InterfaceAccount<'info, Mint>,
    
    /// The token account receiving the minted tokens
    #[account(mut)]
    pub peer_token_account: InterfaceAccount<'info, TokenAccount>,
    
    /// The mint authority
    #[account(mut)]
    pub peer_authority: Signer<'info>,
    
    /// Account to track last mint timestamp
    #[account(
        init_if_needed,
        payer = peer_authority,
        space = 8 + 8, // discriminator + timestamp
        seeds = [
            b"daily-mint",
            peer_authority.key().as_ref()
        ],
        bump
    )]
    pub last_mint: Account<'info, LastMint>,
    
    /// Token program interface
    pub token_program: Interface<'info, TokenInterface>,
    
    /// System program
    pub system_program: Program<'info, System>,
}

/// Account to store last mint timestamp
#[account]
pub struct LastMint {
    pub last_mint_timestamp: i64,
}

/// Helper function to get the peer token account address


#[error_code]
pub enum DailyMintError {
    #[msg("Tokens have already been minted today")]
    AlreadyMintedToday,
    #[msg("Invalid peer token account")]
    InvalidPeerTokenAccount,
} 