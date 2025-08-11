use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenInterface};
use anchor_spl::associated_token::AssociatedToken;

use crate::{
    state::*,
    constants::*,
};


#[derive(Accounts)]
pub struct Peertoken<'info> {

    #[account(mut)]
    pub peer_admin: Signer<'info>,

     #[account(
        init,
        payer = peer_admin,
        space = ProgramConfig::SPACE,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub program_config: Account<'info, ProgramConfig>,

    #[account(
        init,
        payer = peer_admin,
        mint::decimals = TOKEN_DECIMALS,
        mint::authority = mint_authority, //pda
        mint::freeze_authority = mint_authority,
        seeds = [MINT_SEED],
        bump,
    )]
    pub peer_mint : InterfaceAccount<'info, Mint>,
    ///CHECK: PDA 
    #[account(
        seeds = [MINTAUTH_SEED],
        bump
    )]
    pub mint_authority : UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}




pub fn token_handler(ctx: Context<Peertoken>) -> Result <()> {
    let config = &mut ctx.accounts.program_config;
    
    // Initialize fee parameters with defaults
    config.fees = FeeParams {
        burn_percent: DEFAULT_BURN_PERCENT,
        company_percent: DEFAULT_COMPANY_PERCENT,
        lp_percent: DEFAULT_LP_PERCENT,
        referral_percent: DEFAULT_REFERRAL_PERCENT,
        gas_fee_amount: DEFAULT_GAS_FEE,
    };
    
    // Initialize system wallets (Default Empty , can be updated in Wallets Config )
    // Due to Stack Limit of Instruction ( Segregating -> into system , security Wallets )
    config.wallets = SystemWallets {
        minting_wallet: Pubkey::default(),
        treasury_wallet: Pubkey::default(),
        lp_wallet: Pubkey::default(),
        fee_wallet: Pubkey::default(),
    };
    
    // Initialize token configuration
    config.token = TokenConfig {
        peer_mint: ctx.accounts.peer_mint.key(),
        daily_mint_amount: DAILY_MINT_AMOUNT,
        last_mint_reset: Clock::get()?.unix_timestamp,
    };
    
    // Initialize program state
    config.program = ProgramState {
        peer_admin: ctx.accounts.peer_admin.key(),
        peer_admin_2: ctx.accounts.peer_admin.key(), // same admin initially Update Later 
        is_paused: false,
    };
    
    // Initialize reserved space
    config.reserved = [0; 4];
    
    msg!("Token initialized successfully!");
    msg!("Mint Address: {}", ctx.accounts.peer_mint.key());
    msg!("Program Config: {}", ctx.accounts.program_config.key());
    msg!("Admin: {}", ctx.accounts.peer_admin.key());
    
    Ok(())
}