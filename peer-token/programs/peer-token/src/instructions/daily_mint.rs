use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface};
use anchor_spl::token_2022::MintTo;
use crate::error::PeerTokenError;

pub fn handler(ctx: Context<DailyMintArgs>, amount: u64) -> Result<()> {
    // Validate amount
    require!(amount > 0, PeerTokenError::InvalidTransferAmount);
    
    // Create mint_to context
    let mint_to_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        MintTo {
            mint: ctx.accounts.peer_mint.to_account_info(),
            to: ctx.accounts.peer_token_account.to_account_info(),
            authority: ctx.accounts.peer_authority.to_account_info(),
        }
    );

    // Mint tokens
    token_interface::mint_to(mint_to_ctx, amount)?;
    
    msg!("Daily minted {} tokens to {}", amount, ctx.accounts.peer_token_account.key());
    Ok(())
}

#[derive(Accounts)]
pub struct DailyMintArgs<'info> {
    /// The token mint
    #[account(
        mut,
        constraint = peer_mint.mint_authority.unwrap() == peer_authority.key() @ PeerTokenError::InvalidMintAuthority
    )]
    pub peer_mint: InterfaceAccount<'info, Mint>,
    
    /// The token account receiving the minted tokens
    #[account(
        mut,
        constraint = peer_token_account.mint == peer_mint.key() @ PeerTokenError::InvalidMint,
        constraint = peer_token_account.owner == peer_authority.key() @ PeerTokenError::InvalidOwner
    )]
    pub peer_token_account: InterfaceAccount<'info, TokenAccount>,
    
    /// The mint authority
    #[account(mut)]
    pub peer_authority: Signer<'info>,
    
    /// Token program interface
    pub token_program: Interface<'info, TokenInterface>,
    
    /// System program
    pub system_program: Program<'info, System>,
} 