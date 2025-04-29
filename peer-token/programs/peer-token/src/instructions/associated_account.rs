use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

/// Creates an Associated Token Account (ATA) for a given wallet and token mint
/// Can be used by both company wallets and user wallets to create their ATAs
pub fn handler(ctx: Context<CreateTokenAtaArgs>) -> Result<()> {
    msg!("Creating associated token account for mint: {}", ctx.accounts.peer_mint.key());
    msg!("Owner: {}", ctx.accounts.peer_authority.key());
    Ok(())
}

/// Arguments for creating an associated token account (ATA)
/// This instruction can be used by both company wallets and user wallets
/// to create their standard Associated Token Accounts for any token mint
#[derive(Accounts)]
pub struct CreateTokenAtaArgs<'info> {
    /// The fee payer and account owner (can be company wallet or user wallet)
    #[account(mut)]
    pub peer_authority: Signer<'info>,
    
    /// The token mint this ATA will be associated with
    pub peer_mint: InterfaceAccount<'info, Mint>,
    
    /// The associated token account to be created
    /// This follows the standard ATA derivation and will be discoverable by any program
    /// ATA -> mint,wallet address,program id derives the ATA address
    #[account(
        init,
        associated_token::mint = peer_mint,
        payer = peer_authority,
        associated_token::token_program = token_program,
        associated_token::authority = peer_authority,
    )]
    pub peer_token_account: InterfaceAccount<'info, TokenAccount>,
    
    /// System program
    pub system_program: Program<'info, System>,
    
    /// Token program interface (works with Token-2022)
    pub token_program: Interface<'info, TokenInterface>,
    
    /// Associated token program for creating ATAs
    pub associated_token_program: Program<'info, AssociatedToken>,
} 