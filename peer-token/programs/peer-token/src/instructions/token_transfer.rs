use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked},
};

pub fn handler(ctx: Context<TransferTokenArgs>, amount: u64) -> Result<()> {
    let cpi_accounts = TransferChecked {
        from: ctx.accounts.from.to_account_info().clone(),
        mint: ctx.accounts.mint.to_account_info().clone(),
        to: ctx.accounts.to_ata.to_account_info().clone(),
        authority: ctx.accounts.signer.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_context = CpiContext::new(cpi_program, cpi_accounts);
    token_interface::transfer_checked(cpi_context, amount, ctx.accounts.mint.decimals)?;
    
    msg!("Transferred {} tokens from {} to {}", 
        amount, 
        ctx.accounts.from.key(), 
        ctx.accounts.to_ata.key()
    );
    Ok(())
}

/// Arguments for transferring tokens between accounts
#[derive(Accounts)]
pub struct TransferTokenArgs<'info> {
    /// The transaction signer and token authority
    #[account(mut)]
    pub signer: Signer<'info>,
    
    /// Source token account
    #[account(mut)]
    pub from: InterfaceAccount<'info, TokenAccount>,
    
    /// Destination wallet (not token account)
    pub to: SystemAccount<'info>,
    
    /// Destination ATA (will be created if it doesn't exist)
    #[account(
        init,
        associated_token::mint = mint,
        payer = signer,
        associated_token::authority = to
    )]
    pub to_ata: InterfaceAccount<'info, TokenAccount>,
    
    /// Token mint
    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,
    
    /// Token program interface
    pub token_program: Interface<'info, TokenInterface>,
    
    /// System program 
    pub system_program: Program<'info, System>,
    
    /// Associated token program
    pub associated_token_program: Program<'info, AssociatedToken>,
} 