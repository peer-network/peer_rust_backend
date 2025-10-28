
use async_graphql::MergedObject;

pub mod ping;
pub mod wallet_validation;
pub mod check_token_account;
pub mod transform;

pub use ping::PingMutations;
pub use wallet_validation::WalletValidationMutations;
pub use check_token_account::CheckTokenAccountMutations;
pub use transform::TransformMutations;

/// Main Mutation root that combines all mutation modules
#[derive(MergedObject, Default)]
pub struct Mutation(
    PingMutations, 
    WalletValidationMutations, 
    CheckTokenAccountMutations,
    TransformMutations,
);

