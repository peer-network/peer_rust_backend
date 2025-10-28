
use async_graphql::{Object, Result};
use tracing::{info, debug};

/// Simple ping mutations for testing
#[derive(Default)]
pub struct PingMutations;

#[Object]
impl PingMutations {
    
    async fn ping(&self) -> Result<String> {
        info!(" Ping mutation received");
        debug!(" Sending pong response");
        Ok("pong".to_string())
    }
}