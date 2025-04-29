

// Primary Peer-Token 
pub mod mint_token;      // Create mint authority and mint supply
pub mod associated_account;
pub mod mint_to;         // Mint additional tokens to an account
pub mod metadata;        // Create and manage token metadata


// Token operations
pub mod user_token_account;  
pub mod daily_mint;  // User token account with company as fee payer
pub mod token_transfer;        // Token transfers
pub mod airdrop;        // Token airdrop and distribution


// Re-export account structs with clear naming
pub use mint_token::*;
pub use mint_to::*;
pub use metadata::*;
pub use associated_account::*;
pub use user_token_account::*;
pub use token_transfer::*;
pub use daily_mint::*;
pub use airdrop::*;

