use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked},
};

pub fn handler(ctx: Context<TransferTokenArgs>, amount: u64) -> Result<()> {
    let cpi_accounts = TransferChecked {
        from: ctx.accounts.peer_authority_token_account.to_account_info().clone(),
        mint: ctx.accounts.peer_mint.to_account_info().clone(),
        to: ctx.accounts.user_token_account.to_account_info().clone(),
        authority: ctx.accounts.peer_authority.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_context = CpiContext::new(cpi_program, cpi_accounts);
    token_interface::transfer_checked(cpi_context, amount, ctx.accounts.peer_mint.decimals)?;
    
    msg!("Transferred {} tokens from {} to {}", 
        amount, 
        ctx.accounts.peer_authority_token_account.key(), 
        ctx.accounts.user_token_account.key()
    );
    Ok(())
}

/// Arguments for transferring tokens between accounts
#[derive(Accounts)]
pub struct TransferTokenArgs<'info> {
    /// The transaction signer and token authority
    #[account(mut)]
    pub peer_authority: Signer<'info>,
    
    /// Source token account
    #[account(mut)]
    pub peer_authority_token_account: InterfaceAccount<'info, TokenAccount>,
    
    /// Destination wallet (not token account)
    pub to: InterfaceAccount<'info, TokenAccount>,
    
    /// Destination ATA (will be created if it doesn't exist)
    #[account(
        init,
        payer = peer_authority,
        associated_token::mint = peer_mint, 
        associated_token::authority = peer_authority,
        associated_token::token_program = token_program,
    )]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>,
    
    /// Token mint
    #[account(mut)]
    pub peer_mint: InterfaceAccount<'info, Mint>,
    
    /// Token program interface
    pub token_program: Interface<'info, TokenInterface>,
    
    /// System program 
    pub system_program: Program<'info, System>,
    
    /// Associated token program
    pub associated_token_program: Program<'info, AssociatedToken>,
} 