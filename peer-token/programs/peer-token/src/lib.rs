use anchor_lang::prelude::*;


pub mod instructions;
pub mod error;

pub use instructions::associated_account::*;
pub use instructions::mint_token::*;
pub use instructions::metadata::*;
pub use instructions::user_token_account::*;
pub use instructions::daily_mint::*;
pub use instructions::airdrop::*;
pub use error::*;


declare_id!("HXoJTgD7WxQ9P4Y1dyg99agXHoMnr9S9iJ216Rky1hAY");


#[program]
pub mod peer_token {
    use super::*;
    

    pub fn create_token(ctx: Context<MintTokenArgs>) -> Result<()> {
        instructions::mint_token::handler(ctx)
    }
    
    pub fn create_associated_token_account(ctx: Context<CreateTokenAtaArgs>) -> Result<()> {
        instructions::associated_account::handler(ctx)
    }
    
    pub fn create_token_metadata(
        ctx: Context<CreateMetadataArgs>,
        token_decimals: u8,
        token_name: String,
        token_symbol: String, 
        token_uri: String,
    ) -> Result<()> {
        instructions::metadata::handler(ctx, token_decimals, token_name, token_symbol, token_uri)
    }
    

    // Token operation functions
    /// Creates a token account for a user where the company pays the fee
    pub fn create_user_token_account(ctx: Context<CreateUserTokenAccountArgs>) -> Result<()> {
        instructions::user_token_account::handler(ctx)
    }
 

    /// Mint tokens to company account once per day
    pub fn daily_mint(ctx: Context<DailyMintArgs>, amount: u64) -> Result<()> {
        instructions::daily_mint::handler(ctx, amount)
    }

    
    /// Transfers tokens to a recipient wallet
    pub fn transfer_tokens(
        ctx: Context<TransferTokens>,
        amount: u64
    ) -> Result<()> {
        instructions::airdrop::transfer_tokens_handler(ctx, amount)
  }
}