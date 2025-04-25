use anchor_lang::prelude::*;

// Import instruction modules
pub mod instructions;
use instructions::*;

declare_id!("E266nUxdA76AdugwrfV3MNemf7PLTZuY7PofjfgKgXsQ");

#[program]
pub mod peer_token {
    use super::*;

    /// Creates a new token mint with the signer as the mint authority
    pub fn create_token(ctx: Context<MintTokenArgs>, token_name: String) -> Result<()> {
        instructions::mint_token::handler(ctx, token_name)
    }
    
    /// Creates a standard token account for a mint
    pub fn create_token_account(ctx: Context<CreateTokenAccountArgs>) -> Result<()> {
        instructions::token_account::handler(ctx)
    }
    
    /// Creates an associated token account for a mint 
    pub fn create_associated_token_account(ctx: Context<CreateAssociatedAccountArgs>) -> Result<()> {
        instructions::associated_account::handler(ctx)
    }
    
    /// Transfers tokens between accounts
    pub fn transfer_token(ctx: Context<TransferTokenArgs>, amount: u64) -> Result<()> {
        instructions::token_transfer::handler(ctx, amount)
    }
    
    /// Mints new tokens to a specified token account
    pub fn mint_token(ctx: Context<MintToArgs>, amount: u64) -> Result<()> {
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
}
   