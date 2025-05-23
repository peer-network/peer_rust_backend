use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};
use crate::error::PeerTokenError;


pub fn handler(ctx: Context<CreateTokenAtaArgs>) -> Result<()> {
    // Validate mint
    require!(ctx.accounts.peer_mint.is_initialized, PeerTokenError::InvalidMint);
    
    msg!("Creating associated token account for mint: {}", ctx.accounts.peer_mint.key());
    msg!("Owner: {}", ctx.accounts.peer_authority.key());
    Ok(())
}


#[derive(Accounts)]
pub struct CreateTokenAtaArgs<'info> {
    #[account(mut)]
    pub peer_authority: Signer<'info>,
    
    #[account(
        constraint = peer_mint.is_initialized @ PeerTokenError::InvalidMint
    )]
    pub peer_mint: InterfaceAccount<'info, Mint>,
    
    #[account(
        init,
        associated_token::mint = peer_mint,
        payer = peer_authority,
        associated_token::token_program = token_program,
        associated_token::authority = peer_authority,
    )]
    pub peer_token_account: InterfaceAccount<'info, TokenAccount>,
    
    pub system_program: Program<'info, System>,
    
    pub token_program: Interface<'info, TokenInterface>,
    
    /// Associated token program for creating ATAs
    pub associated_token_program: Program<'info, AssociatedToken>,
} 