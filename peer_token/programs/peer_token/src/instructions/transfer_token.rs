use anchor_lang::prelude::*;
use anchor_spl::{
    token_interface::{Mint, TokenAccount, TokenInterface, transfer_checked, TransferChecked},
    associated_token::AssociatedToken,
};

pub fn handler(ctx: Context<TransferToken>, amount: u64) -> Result<()> {
    let mint = &ctx.accounts.mint;
    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program_2022.to_account_info(),
            TransferChecked {
                from: ctx.accounts.sender_token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.recipient_token_account.to_account_info(),
                authority: ctx.accounts.sender.to_account_info(),
            },
        ),
        amount,
        mint.decimals, // decimals
    )?;

    Ok(())
}

#[derive(Accounts)]
pub struct TransferToken<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,
    
    #[account(
        mint::token_program = token_program_2022,
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    
    #[account(
        mut,
        token::mint = mint,
        token::authority = sender,
        token::token_program = token_program_2022,
    )]
    pub sender_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = sender,
        associated_token::mint = mint,
        associated_token::authority = recipient,
        associated_token::token_program = token_program_2022,
    )]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: 
    pub recipient: AccountInfo<'info>,
    
    pub token_program_2022: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
} 