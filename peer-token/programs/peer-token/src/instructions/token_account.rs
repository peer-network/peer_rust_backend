use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

pub fn handler(ctx: Context<CreateTokenAccountArgs>) -> Result<()> {
    msg!("Creating token account for mint: {}", ctx.accounts.mint.key());
    msg!("Authority: {}", ctx.accounts.signer.key());
    Ok(())
}

/// Arguments for creating a standard token account
#[derive(Accounts)]
pub struct CreateTokenAccountArgs<'info> {
    /// The fee payer and account authority
    #[account(mut)]
    pub signer: Signer<'info>,
    
    /// The token mint this account will be associated with
    pub mint: InterfaceAccount<'info, Mint>,
    
    /// The token account to be created (PDA)
    #[account(
        init,
        token::mint = mint,
        token::authority = signer,
        payer = signer,
        seeds = [b"token-2022-token-account", signer.key().as_ref(), mint.key().as_ref()],
        bump,
    )]
    pub token_account: InterfaceAccount<'info, TokenAccount>,
    
    /// System program
    pub system_program: Program<'info, System>,
    
    /// Token program interface (works with Token-2022)
    pub token_program: Interface<'info, TokenInterface>,
} 