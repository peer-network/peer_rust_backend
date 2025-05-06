use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

/// Creates an Associated Token Account (ATA) for a user wallet and token mint
/// The company pays for the account creation but the user owns the account
pub fn handler(ctx: Context<CreateUserTokenAccountArgs>) -> Result<()> {
    msg!("Creating user associated token account for mint: {}", ctx.accounts.peer_mint.key());
    msg!("Owner (user): {}", ctx.accounts.user_wallet.key());
    msg!("Fee payer (company): {}", ctx.accounts.peer_mint.key());
    Ok(())
}

/// Arguments for creating a user's associated token account (ATA)
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
    pub peer_mint: InterfaceAccount<'info, Mint>,
    
    /// The associated token account to be created
    /// This follows the standard ATA derivation and will be discoverable by any program
    /// ATA -> mint,wallet address,program id derives the ATA address
    #[account(
        init,
        payer = peer_authority,
        associated_token::mint = peer_mint,
        associated_token::token_program = token_program,
        associated_token::authority = user_wallet,
    )]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>,
    
    /// System program
    pub system_program: Program<'info, System>,
    
    /// Token program interface (works with Token-2022)
    pub token_program: Interface<'info, TokenInterface>,
    
    /// Associated token program for creating ATAs
    pub associated_token_program: Program<'info, AssociatedToken>,
} 