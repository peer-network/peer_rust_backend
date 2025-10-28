
use async_graphql::{Object, Result, SimpleObject};
use serde::{Deserialize, Serialize};
use tracing::{info, debug};

/// Response for ping query
#[derive(Debug, Serialize, Deserialize, SimpleObject)]
pub struct PingResponse {
    pub message: String,
    pub timestamp: String,
    pub server: String,
}

/// Server status information
#[derive(Debug, Serialize, Deserialize, SimpleObject)]
pub struct ServerStatus {
    pub healthy: bool,
    pub version: String,
    pub uptime: String,
}

/// Query root 
#[derive(Default)]
pub struct Query;

#[Object]
impl Query {
    async fn ping(&self) -> Result<PingResponse> {
        info!("Ping query received");
        
        let now = chrono::Utc::now().to_rfc3339();
        let response = PingResponse {
            message: "pong".to_string(),
            timestamp: now,
            server: "PEER Platform Backend v0.1.0".to_string(),
        };
        
        debug!("Sending pong response: {:?}", response);
        Ok(response)
    }

    async fn status(&self) -> Result<ServerStatus> {
        info!("Status query received");
        
        let status = ServerStatus {
            healthy: true,
            version: env!("CARGO_PKG_VERSION").to_string(),
            uptime: "Just started".to_string(),
        };
        
        debug!("Server status: {:?}", status);
        Ok(status)
    }

    async fn echo(&self, message: String) -> Result<String> {
        info!("Echo query received: {}", message);
        Ok(format!("Echo: {}", message))
    }

    async fn current_time(&self) -> Result<String> {
        info!("Current time query received");
        let now = chrono::Utc::now().to_rfc3339();
        debug!("Returning current time: {}", now);
        Ok(now)
    }
    
}
