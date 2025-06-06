use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};
use crate::error::PeerTokenError;


pub fn handler(ctx: Context<CreateUserTokenAccountArgs>) -> Result<()> {
    // Validate mint
    require!(ctx.accounts.peer_mint.is_initialized, PeerTokenError::InvalidMint);
    
    msg!("Creating user associated token account for mint: {}", ctx.accounts.peer_mint.key());
    msg!("Owner (user): {}", ctx.accounts.user_wallet.key());
    msg!("Fee payer (company): {}", ctx.accounts.peer_mint.key());
    Ok(())
}

/// The company pays for the account creation but the user owns the account
#[derive(Accounts)]
pub struct CreateUserTokenAccountArgs<'info> {
    /// The company wallet that pays for the account creation
    #[account(mut)]
    pub peer_authority: Signer<'info>,
    
    /// The user wallet address that will own the token account
    /// CHECK: This is just a public key, not an actual account that needs to be checked
    pub user_wallet: AccountInfo<'info>,
    
    /// The token mint this ATA will be associated with
    #[account(
        constraint = peer_mint.is_initialized @ PeerTokenError::InvalidMint
    )]
    pub peer_mint: InterfaceAccount<'info, Mint>,
    
    #[account(
        init,
        payer = peer_authority,
        associated_token::mint = peer_mint,
        associated_token::token_program = token_program,
        associated_token::authority = user_wallet,
    )]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>,
    
    pub system_program: Program<'info, System>,
    
    pub token_program: Interface<'info, TokenInterface>,
    
    pub associated_token_program: Program<'info, AssociatedToken>,
} 