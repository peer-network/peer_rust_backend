use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface, transfer},
};
use std::str::FromStr;


#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RecipientData {
    pub user_wallet: Pubkey,
    pub token_amount: u64,
}

/// Need to add the functionality check whether the user has recieved the tokens or not

pub fn transfer_tokens_handler(ctx: Context<TransferTokens>, amount: u64) -> Result<()> {
    // Validate inputs
    require!(amount > 0, ErrorCode::InsufficientAmount);
    
    // Verify there are enough tokens to transfer
    let peer_balance = ctx.accounts.peer_token_account.amount;
    require!(
        amount <= peer_balance,
        ErrorCode::InsufficientFunds
    );
    
    // Transfer tokens from peer token account to user token account
    let cpi_accounts = anchor_spl::token_interface::Transfer {
        from: ctx.accounts.peer_token_account.to_account_info(),
        to: ctx.accounts.user_token_account.to_account_info(),
        authority: ctx.accounts.peer_authority.to_account_info(),
    };
    
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    
    transfer(cpi_ctx, amount)?;
    Ok(())
}
    
   
/// Accounts required for token transfer
#[derive(Accounts)]
pub struct TransferTokens<'info> {
    #[account(mut)]
    pub peer_authority: Signer<'info>,

    /// CHECK: Validated in transfer instruction
    pub user_wallet: AccountInfo<'info>,
    
    pub peer_mint: InterfaceAccount<'info, Mint>,
    
    #[account(mut)]
    pub peer_token_account: InterfaceAccount<'info, TokenAccount>,
    
    #[account(
        mut,
        associated_token::mint = peer_mint,
        associated_token::authority = user_wallet,
        associated_token::token_program = token_program,
    )]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>,
    
    pub token_program: Interface<'info, TokenInterface>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    
    pub system_program: Program<'info, System>,
}



/// Custom errors with descriptive messages
#[error_code]
pub enum ErrorCode {
    #[msg("Cannot transfer zero or insufficient amount")]
    InsufficientAmount,
    
    #[msg("Insufficient funds in peer token account")]
    InsufficientFunds,
    
    #[msg("Invalid mint account")]
    InvalidMint,
    
    #[msg("Invalid token account owner")]
    InvalidOwner,
}