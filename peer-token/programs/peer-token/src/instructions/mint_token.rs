use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenInterface};

pub fn handler(ctx: Context<MintTokenArgs>) -> Result<()> {
    msg!("Mint authority: {}", ctx.accounts.peer_authority.key());
    msg!("Token decimals: 9 (marked as fungible)");
    Ok(())
}

#[derive(Accounts)]
pub struct MintTokenArgs<'info> {
    #[account(mut)]
    pub peer_authority: Signer<'info>,
    
    #[account(
        init,
        payer = peer_authority,
        mint::decimals = 9,  
        mint::authority = peer_authority.key(),
        mint::freeze_authority = peer_authority.key(),
        seeds = [b"peer-token"],
        bump,
    )]
    pub peer_mint: InterfaceAccount<'info, Mint>,

    pub system_program: Program<'info, System>,
    
    /// Token program interface (works with Token-2022)
    pub token_program: Interface<'info, TokenInterface>,
    
    pub rent: Sysvar<'info, Rent>,
} 