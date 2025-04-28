use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenInterface};

pub fn handler(ctx: Context<MintTokenArgs>) -> Result<()> {
    msg!("Mint authority: {}", ctx.accounts.peer_authority.key());
    msg!("Token decimals: 9 (marked as fungible)");
    Ok(())
}

/// Arguments for creating a new token mint
#[derive(Accounts)]
pub struct MintTokenArgs<'info> {
    /// The fee payer and mint authority
    #[account(mut)]
    pub peer_authority: Signer<'info>,
    
    /// The token mint account to be created
    /// 6 decimals makes this a fungible token, not an NFT
    #[account(
        init,
        payer = peer_authority,
        mint::decimals = 9,  // IMPORTANT: > 0 decimals for fungible tokens
        mint::authority = peer_authority.key(),
        mint::freeze_authority = peer_authority.key(),
        seeds = [b"peer-token"],
        bump,
    )]
    pub peer_mint: InterfaceAccount<'info, Mint>,
  
    /// System program
    pub system_program: Program<'info, System>,
    
    /// Token program interface (works with Token-2022)
    pub token_program: Interface<'info, TokenInterface>,
    
    /// Rent sysvar
    pub rent: Sysvar<'info, Rent>,
} 