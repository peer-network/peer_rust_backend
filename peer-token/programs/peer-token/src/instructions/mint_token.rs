use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenInterface};

pub fn handler(ctx: Context<MintTokenArgs>, token_name: String) -> Result<()> {
    msg!("Creating new Token-2022 FUNGIBLE token mint: {}", token_name);
    msg!("Mint authority: {}", ctx.accounts.signer.key());
    msg!("Token decimals: 9 (marked as fungible)");
    Ok(())
}

/// Arguments for creating a new token mint
#[derive(Accounts)]
#[instruction(token_name: String)]
pub struct MintTokenArgs<'info> {
    /// The fee payer and mint authority
    #[account(mut)]
    pub signer: Signer<'info>,

    /// The token mint account to be created
    /// 6 decimals makes this a fungible token, not an NFT
    #[account(
        init,
        payer = signer,
        mint::decimals = 9,  // IMPORTANT: > 0 decimals for fungible tokens
        mint::authority = signer.key(),
        seeds = [b"token-2022-token", signer.key().as_ref(), token_name.as_bytes()],
        bump,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    /// System program
    pub system_program: Program<'info, System>,
    
    /// Token program interface (works with Token-2022)
    pub token_program: Interface<'info, TokenInterface>,
} 