use anchor_lang::prelude::*;
use anchor_spl::{
    token_interface::{Mint, TokenInterface},
    token_2022::{initialize_mint2, InitializeMint2},
};

pub fn handler(
    ctx: Context<CreateToken>,
    name: String,
    symbol: String,
    uri: String,
) -> Result<()> {

    Ok(())
}

#[derive(Accounts)]
pub struct CreateToken<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        init,
        payer = authority,
        mint::decimals = 9,
        mint::authority = authority,
        mint::token_program = token_program_2022,
    )] 
    pub mint: InterfaceAccount<'info, Mint>,
    
    pub token_program_2022: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
    
    
} 