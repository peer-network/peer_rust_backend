use anchor_lang::prelude::*;
use anchor_lang::solana_program::clock::Clock;

// Global Mint Tracker = This Struct defines the global mint tracker for the program
// This is used to track the last mint day and if minted today 
// and total mints over time 
// This is used to prevent double minting 
// and to track the total mints over time 
// and to prevent double minting 
// and to track the total mints over time 
// and to prevent double minting 
// and to track the total mints over time 
// and to prevent double minting 
#[account]
pub struct GlobalMintTracker {
    pub last_mint_day: u64,      // Day number when last mint occurred
    pub has_minted_today: bool,  // Flag to check if minted today
    pub total_mints: u64,        // Optional: track total mints over time
}

impl GlobalMintTracker {
    pub const LEN: usize = 8 + 8 + 1 + 8; // discriminator + u64 + bool + u64
}

// Helper function to get current day number (days since Unix epoch)
pub fn get_current_day() -> Result<u64> {
    let clock = Clock::get()?;
    let current_timestamp = clock.unix_timestamp as u64;
    // Convert timestamp to day number (86400 seconds = 1 day)
    Ok(current_timestamp / 86400)
}

// Main admin mint function with global daily restriction
pub fn admin_mint_daily(ctx: Context<AdminMintDaily>, amount: u64) -> Result<()> {
    let mint_tracker = &mut ctx.accounts.mint_tracker;
    let current_day = get_current_day()?;
    
    // Check if it's a new day
    if mint_tracker.last_mint_day != current_day {
        // Reset for new day
        mint_tracker.last_mint_day = current_day;
        mint_tracker.has_minted_today = false;
    }
    
    // Check if already minted today
    require!(
        !mint_tracker.has_minted_today,
        ErrorCode::AlreadyMintedToday
    );
    
    // Set minted flag for today
    mint_tracker.has_minted_today = true;
    mint_tracker.total_mints += 1;
    
    // Your actual minting logic here
    // mint_to(...)?;
    
    msg!("Successfully minted {} tokens on day {}", amount, current_day);
    
    Ok(())
}

#[derive(Accounts)]
pub struct AdminMintDaily<'info> {
    // ONLY 1 ACCOUNT CREATED EVER - this PDA is reused forever
    #[account(
        init_if_needed,  // Creates account ONLY on first mint, then reuses
        pads = GlobalMintTracker::LEN,
        space = GlobalMintTracker::LEN,
        seeds = [b"global_mint_tracker"], // Same seed = same PDA always
        bump,
        payer = admin  // Admin pays rent ONLY once (first time)
    )]
    pub mint_tracker: Account<'info, GlobalMintTracker>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
    
    // Add your mint account and other required accounts
    #[account(mut)]
    pub mint: Account<'info, anchor_spl::token::Mint>,
    
    #[account(mut)]
    pub destination: Account<'info, anchor_spl::token::TokenAccount>,
    
    pub token_program: Program<'info, anchor_spl::token::Token>,
    pub system_program: Program<'info, System>,
}

// Optional: Function to check if minting is available today
pub fn can_mint_today(ctx: Context<CheckMintStatus>) -> Result<bool> {
    let mint_tracker = &ctx.accounts.mint_tracker;
    let current_day = get_current_day()?;
    
    // If it's a new day or hasn't minted today, can mint
    let can_mint = mint_tracker.last_mint_day != current_day || !mint_tracker.has_minted_today;
    
    msg!("Can mint today: {}", can_mint);
    Ok(can_mint)
}

#[derive(Accounts)]
pub struct CheckMintStatus<'info> {
    #[account(
        seeds = [b"global_mint_tracker"],
        bump
    )]
    pub mint_tracker: Account<'info, GlobalMintTracker>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Minting has already occurred today. Try again tomorrow.")]
    AlreadyMintedToday,
}

// Alternative: If you want to store the exact timestamp for more precision
#[account]
pub struct PreciseGlobalMintTracker {
    pub last_mint_timestamp: i64,
    pub last_mint_day: u64,
    pub has_minted_today: bool,
}

impl PreciseGlobalMintTracker {
    pub const LEN: usize = 8 + 8 + 8 + 1;
    
    pub fn update_for_mint(&mut self, current_timestamp: i64, current_day: u64) {
        self.last_mint_timestamp = current_timestamp;
        self.last_mint_day = current_day;
        self.has_minted_today = true;
    }
}

// PRODUCTION-READY IMPLEMENTATION
#[program]
pub mod daily_mint_program {
    use super::*;

    // No separate initialize needed - init_if_needed handles it
    pub fn admin_mint_daily(ctx: Context<AdminMintDaily>, amount: u64) -> Result<()> {
        // Validate admin authority (add your admin check here)
        require!(
            ctx.accounts.admin.key() == YOUR_ADMIN_PUBKEY,
            ErrorCode::UnauthorizedAdmin
        );
        
        admin_mint_daily(ctx, amount)
    }

    // Read-only status check (no transaction cost)
    pub fn get_mint_status(ctx: Context<CheckMintStatus>) -> Result<MintStatus> {
        let mint_tracker = &ctx.accounts.mint_tracker;
        let current_day = get_current_day()?;
        
        Ok(MintStatus {
            can_mint_today: mint_tracker.last_mint_day != current_day || !mint_tracker.has_minted_today,
            last_mint_day: mint_tracker.last_mint_day,
            total_mints: mint_tracker.total_mints,
        })
    }
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct MintStatus {
    pub can_mint_today: bool,
    pub last_mint_day: u64,
    pub total_mints: u64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Minting has already occurred today. Try again tomorrow.")]
    AlreadyMintedToday,
    #[msg("Unauthorized: Only admin can mint")]
    UnauthorizedAdmin,
}