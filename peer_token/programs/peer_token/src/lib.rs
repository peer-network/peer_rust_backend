use anchor_lang::prelude::*;
use anchor_spl::{
    token_interface::{
        Mint, TokenAccount, TokenInterface,
        spl_token_2022::extension::{metadata_pointer, ExtensionType},
    },
    associated_token::AssociatedToken,
};

pub mod instructions;
use instructions::*;


declare_id!("FQahsxqzzkvVQDC7W7kA16cUALfgZ9M2UUH9utV4V9YL");


#[program] 
pub mod peer_token {
    use super::*;

    pub fn create_mint(
        ctx: Context<CreateToken>,
        name: String,
        symbol: String,
        uri: String,
    ) -> Result<()> {
        instructions::create_mint::handler(ctx, name, symbol, uri)
    }

    pub fn mint_token(
        ctx: Context<MintToken>,
        amount: u64,
    ) -> Result<()> {
        instructions::mint_token::handler(ctx, amount)
    }

    pub fn burn_token(
        ctx: Context<BurnToken>,
        amount: u64,
    ) -> Result<()> {
        instructions::burn_token::handler(ctx, amount)
    }

    pub fn transfer_token(
        ctx: Context<TransferToken>,
        amount: u64,
    ) -> Result<()> {
        instructions::transfer_token::handler(ctx, amount)
    }
}