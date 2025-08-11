use anchor_lang::prelude::*;

pub mod state;
pub mod constants;
pub mod instructions;
pub mod errors;

pub use instructions::*;

declare_id!("2PfkQSFbtTacMG56GqMkm12V2VuVDLqM17gSbvAiwtbw");


#[program]
pub mod peer_token {
    use super::*;

    /// Initialize the Token mint and Default program configuration
    pub fn initialize(ctx: Context<Peertoken>) -> Result<()> {
        instructions::initialize::create_token::token_handler(ctx)
    }

    /// Initialize system wallets (Treasury & Fee) 
    pub fn initialize_system_wallets(ctx: Context<InitializeSystemWallets>) -> Result<()> {
        instructions::initialize::system_wallets::system_handler(ctx)
    }

    /// Initialize security wallets (LP & Minting)
    pub fn initialize_security_wallets(ctx: Context<InitializeSecurityWallets>) -> Result<()> {
        instructions::initialize::security_wallets::security_handler(ctx)
    }

    pub fn daily_mint_exec(ctx: Context<DailyMint>) -> Result<()> {
        instructions::minting::daily_mint::daily_mint_handler(ctx)
    }
}


