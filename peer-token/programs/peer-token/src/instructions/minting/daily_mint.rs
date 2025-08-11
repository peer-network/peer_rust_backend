//! Daily minting to the minting wallet with strict limits and security
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface, MintTo};
use anchor_spl::token_interface;
// use anchor_spl::token_2022::MintTo;
use anchor_spl::associated_token::AssociatedToken;

use crate::{
    state::*,
    constants::*,
    errors::PeerTokenError,
};

/// Daily mint instruction - mints to minting wallet only
pub fn daily_mint_handler(ctx: Context<DailyMint>) -> Result<()> {
    msg!(" Executing daily mint to minting wallet...");
    
    let config = &mut ctx.accounts.program_config;
    let clock = Clock::get()?;
    let current_time = clock.unix_timestamp;

    
    // VALIDATIONS

    // Program operational check
    require!(!config.program.is_paused, PeerTokenError::UnauthorizedOperation);

    // Validate all wallets are initialized
    require_keys_eq!(
        config.wallets.minting_wallet,
        Pubkey::default(),
        PeerTokenError::UnauthorizedOperation
    );

    // Validate minting ATA matches expected derivation
    let expected_minting_ata = config.wallets.get_minting_ata(&config.token.peer_mint);
    require_keys_eq!(
        ctx.accounts.minting_ata.key(),
        expected_minting_ata,
        PeerTokenError::InvalidTokenAccount
    );

    // Validate ATA ownership
    require_keys_eq!(
        ctx.accounts.minting_ata.owner,
        config.wallets.minting_wallet,
        PeerTokenError::InvalidOwner
    );

    // ═══════════════════════════════════════════════════════════
    // 📅 DAILY MINT LIMIT VALIDATION
    // ═══════════════════════════════════════════════════════════

    // Check if it's a new day
    let time_since_reset = current_time.saturating_sub(config.token.last_mint_reset);
    let is_new_day = time_since_reset >= 86400; // 24 hours in seconds

    if is_new_day {
        // Reset daily counter for new day
        config.token.daily_mint_amount = 0;
        config.token.last_mint_reset = current_time;
        msg!("🔄 Daily mint limit reset for new day");
    }

    //  Check daily mint limit
    let mint_amount = DAILY_MINT_AMOUNT;
    require_eq!(
        config.token.daily_mint_amount,
        0,
        PeerTokenError::AlreadyMintedToday
    );

    
    //  EXECUTE MINT TO 
    

    // Mintauth PDA signer
    let mint_seeds = &[
        MINTAUTH_SEED,  
        &[ctx.bumps.mint_authority]
    ];
    let signer_seeds = &[&mint_seeds[..]];

    // Inputs for mint_to 
    let mint_cpi_accounts = MintTo {
        mint: ctx.accounts.peer_mint.to_account_info(),
        to: ctx.accounts.minting_ata.to_account_info(),
        authority: ctx.accounts.mint_authority.to_account_info(),
    };

    // Cpi Context with Signer 
    let mint_cpi_context = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        mint_cpi_accounts,
        signer_seeds,
    );

    // Execute mint
    token_interface::mint_to(mint_cpi_context, mint_amount)?;

    // Update state tracking
    config.token.daily_mint_amount = mint_amount;

    // Emit mint event for monitoring
    emit!(DailyMintEvent {
        mint: ctx.accounts.peer_mint.key(),
        minting_wallet: config.wallets.minting_wallet,
        minting_ata: ctx.accounts.minting_ata.key(),
        amount: mint_amount,
        timestamp: current_time,
        day_reset: is_new_day,
    });

    msg!(" Daily mint completed successfully!");
    msg!(" Amount minted: {} PEER tokens", mint_amount / 1_000_000_000);
    msg!(" Minted to: {}", ctx.accounts.minting_ata.key());
    msg!(" Next mint available: {} hours", 
        (86400 - (Clock::get()?.unix_timestamp - config.token.last_mint_reset)) / 3600
    );

    Ok(())
}

/// Daily mint accounts structure
#[derive(Accounts)]
pub struct DailyMint<'info> {
    /// Program configuration
    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub program_config: Account<'info, ProgramConfig>,

    /// Peer token mint
    #[account(
        mut,
        seeds = [MINT_SEED],
        bump
    )]
    pub peer_mint: InterfaceAccount<'info, Mint>,

    /// Mint authority PDA
    /// CHECK: This is a PDA mint authority, validated by seeds in the instruction.
    #[account(
        seeds = [MINTAUTH_SEED],
        bump
    )]
    pub mint_authority: UncheckedAccount<'info>,

    /// Minting wallet ATA (receives minted tokens)
    #[account(
        mut,
        constraint = minting_ata.key() == program_config.wallets.get_minting_ata(&program_config.token.peer_mint)
            @ PeerTokenError::InvalidTokenAccount,
        constraint = minting_ata.owner == program_config.wallets.minting_wallet
            @ PeerTokenError::InvalidOwner,
        constraint = minting_ata.mint == program_config.token.peer_mint
            @ PeerTokenError::InvalidMint
    )]
    pub minting_ata: InterfaceAccount<'info, TokenAccount>,

    /// Token program
    pub token_program: Interface<'info, TokenInterface>,
}

/// Daily mint event for monitoring and analytics
#[event]
pub struct DailyMintEvent {
    pub mint: Pubkey,
    pub minting_wallet: Pubkey,
    pub minting_ata: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
    pub day_reset: bool,
}
