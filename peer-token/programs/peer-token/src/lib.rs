use anchor_lang::prelude::*;

// Import instruction modules
pub mod instructions;
use instructions::*;

// Import instruction structs
use instructions::mint_token::MintTokenArgs;
use instructions::token_account::CreateTokenAccountArgs;
use instructions::associated_account::CreateTokenAtaArgs;
use instructions::user_token_account::CreateUserTokenAccountArgs;
use instructions::token_transfer::TransferTokenArgs;
use instructions::mint_to::MintToArgs;
use instructions::metadata::CreateMetadataArgs;
use instructions::daily_mint::DailyMint;

declare_id!("DAApXWPZsSdDUPRhmSgQTuwKqT8ooR9oboGz9wLK69n9");

#[program]
pub mod peer_token {
    use super::*;

    /// Creates a new token mint with the signer as the mint authority
    pub fn create_token(ctx: Context<MintTokenArgs>) -> Result<()> {
        instructions::mint_token::handler(ctx)
    }
    
    /// Creates a standard token account for a mint
    pub fn create_token_account(ctx: Context<CreateTokenAccountArgs>) -> Result<()> {
        instructions::token_account::handler(ctx)
    }
    
    /// Creates an associated token account for a mint 
    pub fn create_associated_token_account(ctx: Context<CreateTokenAtaArgs>) -> Result<()> {
        instructions::associated_account::handler(ctx)
    }
    
    /// Creates a token account for a user where the company pays the fee
    pub fn create_user_token_account(ctx: Context<CreateUserTokenAccountArgs>) -> Result<()> {
        instructions::user_token_account::handler(ctx)
    }
    
    /// Transfers tokens between accounts
    pub fn transfer_token(ctx: Context<TransferTokenArgs>, amount: u64) -> Result<()> {
        instructions::token_transfer::handler(ctx, amount)
    }
    
    /// Mints new tokens to a specified token account
    pub fn mint_to(ctx: Context<MintToArgs>, amount: u64) -> Result<()> {
        instructions::mint_to::handler(ctx, amount)
    }
    
    /// Creates token metadata via Metaplex
    pub fn create_token_metadata(
        ctx: Context<CreateMetadataArgs>,
        token_decimals: u8,
        token_name: String,
        token_symbol: String, 
        token_uri: String,
    ) -> Result<()> {
        instructions::metadata::handler(ctx, token_decimals, token_name, token_symbol, token_uri)
    }
    
    /// Mint tokens to company account once per day
    pub fn daily_mint(ctx: Context<DailyMint>, amount: u64) -> Result<()> {
        instructions::daily_mint::handler(ctx, amount)
    }
}
   