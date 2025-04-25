use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

pub fn handler(ctx: Context<CreateAssociatedAccountArgs>) -> Result<()> {
    msg!("Creating associated token account for mint: {}", ctx.accounts.mint.key());
    msg!("Owner: {}", ctx.accounts.signer.key());
    Ok(())
}

/// Arguments for creating an associated token account
#[derive(Accounts)]
pub struct CreateAssociatedAccountArgs<'info> {
    /// The fee payer and account owner 
    #[account(mut)]
    pub signer: Signer<'info>,
    
    /// The token mint this ATA will be associated with
    pub mint: InterfaceAccount<'info, Mint>,
    
    /// The associated token account to be created
    #[account(
        init,
        associated_token::mint = mint,
        payer = signer,
        associated_token::authority = signer,
    )]
    pub token_account: InterfaceAccount<'info, TokenAccount>,
    
    /// System program
    pub system_program: Program<'info, System>,
    
    /// Token program interface (works with Token-2022)
    pub token_program: Interface<'info, TokenInterface>,
    
    /// Associated token program for creating ATAs
    pub associated_token_program: Program<'info, AssociatedToken>,
} 