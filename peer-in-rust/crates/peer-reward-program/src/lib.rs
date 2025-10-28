// Peer Reward Program - Solana On-Chain Program
// Allows users to claim rewards by paying their own gas fees
// Company signs authorization messages, program verifies and releases tokens

pub mod error;
pub mod instruction;
pub mod processor;
pub mod state;

#[cfg(not(feature = "no-entrypoint"))]
pub mod entrypoint;

// Re-export for convenience
pub use error::RewardError;
pub use instruction::RewardInstruction;
pub use processor::Processor;

solana_program::declare_id!("11111111111111111111111111111111"); // TODO: Replace with deployed program ID
