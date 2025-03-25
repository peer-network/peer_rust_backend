use anchor_lang::prelude::*;
use anchor_spl::{
    token_interface::{Mint, TokenAccount, TokenInterface, mint_to, MintTo},
    associated_token::AssociatedToken,
};

pub fn handler(ctx: Context<MintToken>, amount: u64) -> Result<()> {
    mint_to(
        CpiContext::new(
            ctx.accounts.token_program_2022.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.recipient_token_account.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        ),
        amount,
    )?;

    Ok(())
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct MintToken<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: 
    pub recipient: UncheckedAccount<'info>,
    
    #[account(
        mut,
        mint::authority = authority,
        mint::token_program = token_program_2022,
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    
    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = recipient,
        associated_token::token_program = token_program_2022,
    )]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,
    
    pub token_program_2022: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
} 