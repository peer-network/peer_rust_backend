mod graphql;
mod services;
mod solana;



// use peer_common::utils::logging;
use peer_common::utils::{Result, logging, PlatformError, TokenError};
use peer_common::config::PlatformConfig;
use services::graphql_server::GraphQLServer;
use tracing::info;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    
    dotenvy::dotenv().ok();
    logging::initialize_logging("peer-server")
        .expect("Failed to initialize logging");
    
    info!("Starting PEER Rust-Backend Server");
    info!("  ==========================================  ");
    
    // Load configuration
    let config = PlatformConfig::load()?;
    info!("Configuration loaded successfully");
    
    // Start GraphQL server
    let server = GraphQLServer::new(config).await?;
    
    let host = server.host();
    let port = server.port();
    
    info!("GraphQL server starting on http://{}:{}", host, port);
    
    // Print to stdout so user sees it in terminal
    println!("\n  Peer server running on http://{}:{}", host, port);
    println!("   GraphQL API:    http://{}:{}/graphql", host, port);
  
    
    // Run the server (this blocks until shutdown)
    server.run().await?;
    
    Ok(())
}
