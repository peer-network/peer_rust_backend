use anchor_lang::prelude::*;

pub mod instructions;
// Import from the module using wildcard import
use instructions::airdrop::*;

declare_id!("3AhrXXfZ6QLe4bswBjkszDMb5RjnvhELNxESGRwK9jUk");

#[program]
pub mod peer_token {
    use super::*;
    
    /// Initialize token transfer functionality
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        instructions::airdrop::initialize_handler(ctx)
    }
    
    /// Transfers tokens to a recipient wallet
    pub fn transfer_tokens(
        ctx: Context<TransferTokens>,
        amount: u64
    ) -> Result<()> {
        instructions::airdrop::transfer_tokens_handler(ctx, amount)
    }
}