use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, MintTo, TokenAccount, TokenInterface};

pub fn handler(ctx: Context<MintToArgs>, amount: u64) -> Result<()> {
    let cpi_accounts = MintTo {
        mint: ctx.accounts.mint.to_account_info().clone(),
        to: ctx.accounts.receiver.to_account_info().clone(),
        authority: ctx.accounts.signer.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_context = CpiContext::new(cpi_program, cpi_accounts);
    token_interface::mint_to(cpi_context, amount)?;
    
    msg!("Minted {} tokens to {}", amount, ctx.accounts.receiver.key());
    Ok(())
}

/// Arguments for minting tokens to an account
#[derive(Accounts)]
pub struct MintToArgs<'info> {
    /// The mint authority
    #[account(mut)]
    pub signer: Signer<'info>,
    
    /// The token mint
    #[account(
        mut,
        constraint = mint.mint_authority.unwrap() == signer.key()
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    
    /// The token account receiving the newly minted tokens
    #[account(
        mut,
        constraint = receiver.mint == mint.key(),
        constraint = receiver.owner != Pubkey::default()
    )]
    pub receiver: InterfaceAccount<'info, TokenAccount>,
    
    /// Token program interface
    pub token_program: Interface<'info, TokenInterface>,
} 