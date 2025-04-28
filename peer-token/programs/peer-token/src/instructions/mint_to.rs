use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, MintTo, TokenAccount, TokenInterface};

pub fn handler(ctx: Context<MintToArgs>, amount: u64) -> Result<()> {
    let cpi_accounts = MintTo {
        mint: ctx.accounts.peer_mint.to_account_info().clone(),
        to: ctx.accounts.peer_token_account.to_account_info().clone(),
        authority: ctx.accounts.peer_authority.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_context = CpiContext::new(cpi_program, cpi_accounts);
    token_interface::mint_to(cpi_context, amount)?;
    
    msg!("Minted {} tokens to {}", amount, ctx.accounts.peer_token_account.key());
    Ok(())
}

/// Arguments for minting tokens to an account
#[derive(Accounts)]
pub struct MintToArgs<'info> {
    /// The mint authority
    #[account(mut)]
    pub peer_authority: Signer<'info>, //Peer_Authority = Jakob
    
    /// The token mint
    #[account(
        mut,
        constraint = peer_mint.mint_authority.unwrap() == peer_authority.key()
    )]
    pub peer_mint: InterfaceAccount<'info, Mint>,
    
    /// The token account receiving the newly minted tokens
    #[account(
        mut,
        constraint = peer_token_account.mint == peer_mint.key(),
        constraint = peer_token_account.owner != Pubkey::default()
    )]
    pub peer_token_account: InterfaceAccount<'info, TokenAccount>,
    
    /// Token program interface
    pub token_program: Interface<'info, TokenInterface>,
} 