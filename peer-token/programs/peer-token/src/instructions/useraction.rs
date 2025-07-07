use anchor_lang::prelude::*;
use anchor_spl::{
    token_2022::transfer_checked,
    token_interface::{Mint, TokenAccount, TokenInterface, TransferChecked}
};
use crate::error::PeerTokenError;







#[derive(Accounts)]
pub struct TransferToken<'info> {
 

    #[account(mut)]
    pub peer_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub sender_wallet: Signer<'info>,

    /// CHECK: Already check in the Backend
    #[account(mut)]
    pub recipient_wallet: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = sender_token_account.owner == sender_wallet.key() @ PeerTokenError::UnauthorizedTokenAccount,
    )]
    pub sender_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = recipient_token_account.mint == peer_mint.key() @ PeerTokenError::InvalidMint,

    )]
    pub recipient_token_account: InterfaceAccount<'info,TokenAccount>,
    

    pub token_program: Interface<'info, TokenInterface>,

    pub system_program: Program<'info, System> 
    
}


pub fn transfer_handler(ctx: Context<TransferToken>, amount: u64) -> Result <()> {
        
        require!(
            ctx.accounts.sender_token_account.amount >= amount,
            PeerTokenError::InsufficientPeerTokens
        );

        require!(
            ctx.accounts.sender_token_account.mint == ctx.accounts.peer_mint.key(),
            PeerTokenError::InvalidMint
        );

        require!(
            ctx.accounts.recipient_token_account.mint == ctx.accounts.peer_mint.key(),
            PeerTokenError::InvalidMint
        );

        require!(
            ctx.accounts.sender_token_account.owner == ctx.accounts.sender_wallet.key(),
            PeerTokenError::UnauthorizedTokenAccount
        );

        require!(
            ctx.accounts.sender_wallet.is_signer,
            PeerTokenError::UnauthorizedSigner,
        );

        let cpi_accounts = TransferChecked{
            from: ctx.accounts.sender_token_account.to_account_info(),
            mint: ctx.accounts.peer_mint.to_account_info(),
            to: ctx.accounts.recipient_token_account.to_account_info(),
            authority: ctx.accounts.sender_wallet.to_account_info(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();

        let cpi_ctx = CpiContext::new(cpi_program,cpi_accounts);
        
        
        transfer_checked(cpi_ctx, amount, ctx.accounts.peer_mint.decimals)?;
        
        Ok(())



}

