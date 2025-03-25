use anchor_lang::prelude::*;
use anchor_spl::{
    token_interface::{Mint, TokenAccount, TokenInterface, burn, Burn},
};

pub fn handler(ctx: Context<BurnToken>, amount: u64) -> Result<()> {
    burn(
        CpiContext::new(
            ctx.accounts.token_program_2022.to_account_info(),
            Burn {
                mint: ctx.accounts.mint.to_account_info(),
                from: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        ),
        amount,
    )?;

    Ok(())
}

#[derive(Accounts)]
pub struct BurnToken<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        mint::authority = authority,
        mint::token_program = token_program_2022,
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    
    #[account(
        mut,
        token::mint = mint,
        token::authority = authority,
        token::token_program = token_program_2022,
    )]
    pub token_account: InterfaceAccount<'info, TokenAccount>,
    
    pub token_program_2022: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
} 