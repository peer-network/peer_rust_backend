
mod token;
use tracing::{info, warn, error, debug};
use std::env;
use dotenvy::dotenv;
use clap::{Parser, Subcommand};
use peer_common::utils::{Result, logging, PlatformError, TokenError};
use crate::token::{TokenConfig, TokenManager, TokenStatus};


/// PEER Token CLI - Manage PEER token on Solana
#[derive(Parser)]           
#[command(name = "peer-token")]
#[command(author = "PEER Inc.")]
#[command(version = "1.0.0")]
#[command(about = "Manage PEER token on Solana blockchain", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    Create,
    Status,
    Lock,    
    Reset,
}

#[tokio::main]
async fn main() -> Result<()> {

    dotenv().ok();
    
    logging::initialize_logging("peer-token")
       .expect("Failed to initialize logging");

    let config = TokenConfig::load()?;
    debug!("Configuration loaded successfully");

    let cli = Cli::parse();

    match cli.command {
        Commands::Create => create_token(config).await,
        Commands::Status => show_status(config).await,
        Commands::Lock => lock_mint(config).await,
        Commands::Reset => reset_state(config).await,
    }
}

async fn create_token(config: TokenConfig) -> Result<()> {
    info!("Initiating PEER token creation");

    println!("\n╔══════════════════════════════════════════════╗");
    println!("║     PEER TOKEN CREATION                      ║");
    println!("╚══════════════════════════════════════════════╝\n");


    let mut manager = TokenManager::new(config)?;
    

    match manager.get_status() {
        TokenStatus::NotCreated => {
            println!("✓ Status check: Token not created yet");
            info!("Token creation can proceed");
        },
        status => {
            println!("✗ Token already exists!");
            println!("  Current status: {:?}", status);
            println!("  Run: peer-token status");
            error!("Token creation blocked - already exists: {:?}", status);
            error!("  Run: peer-token status");
            return Err(PlatformError::Token(TokenError::TokenAlreadyExists));
        }
    }


    if !confirm_creation()? {
        println!("\n⚠ Token creation cancelled by user");
        info!("Token creation cancelled by user");
        return Ok(());
    }


    println!("\n⏳ Creating token on Solana blockchain...");
    info!("Executing token creation on Solana blockchain");

    // Execute token creation
    match manager.create_token().await {
        Ok(result) => {
            println!("\n╔══════════════════════════════════════════════╗");
            println!("║     ✓ TOKEN CREATED SUCCESSFULLY             ║");
            println!("╚══════════════════════════════════════════════╝\n");
            println!("Mint Address:       {}", result.mint_address);
            println!("Admin Account:      {}", result.admin_token_account);
            println!("Initial Supply:     {} PEER", result.initial_supply);
            println!("Cluster:            {}", result.cluster);
            println!("Explorer:           {}", result.get_explorer_url());

            
            
            if let Some(stats) = manager.get_creation_stats() {
                println!("\nCreation Stats:");
                println!("  Cost:             {:.6} SOL", stats.total_cost_sol);
                println!("  Transactions:     {}", stats.total_transactions);
                println!("  Duration:         {}ms", stats.creation_duration_ms);
            }


            println!("\n Save these for production:");
            println!("   PEER_MINT_ADDRESS={}", result.mint_address);
            println!("   ADMIN_TOKEN_ACCOUNT={}", result.admin_token_account);
            
            println!("\n Next Steps:");
            println!("   1. Verify on explorer (see link above)");
            println!("   2. Update production config");
            println!("   3. Run 'peer-token lock' to secure mint\n");

            info!(
                mint_address = %result.mint_address,
                admin_account = %result.admin_token_account,
                supply = result.initial_supply,
                cluster = %result.cluster,
                "Token created successfully"
            );
            Ok(())
        },
        Err(e) => {
            println!("\n✗ Token creation failed!");
            println!("  Error: {}", e);
            println!("\n  Check logs for details: logs/peer-token-*.log");
            error!("Token creation failed: {}", e);
            Err(e)
        }
    }
}


async fn show_status(config: TokenConfig) -> Result<()> {
    debug!("Status check requested");
    
    println!("\n╔══════════════════════════════════════════════╗");
    println!("║         PEER TOKEN STATUS                    ║");
    println!("╚══════════════════════════════════════════════╝\n");
    
    let manager = TokenManager::new(config)?;
    
    match manager.get_status() {
        TokenStatus::NotCreated => {
            println!("Status:    Not Created\n");
            println!("The PEER token has not been created yet.");
            println!("Run: peer-token create\n");
            
            info!("Status: Token not created");
        },
        
        TokenStatus::Created => {
            if let Some(result) = manager.get_result() {
                println!("Status:         ✓ Created");
                println!("Mint Address:   {}", result.mint_address);
                println!("Total Supply:   {} PEER", result.initial_supply);
                println!("Mint Locked:    {}\n", if result.mint_lock_status { "Yes ✓" } else { "No ⚠" });
                println!("Created:        {}", format_timestamp(result.creation_timestamp));
                println!("Explorer:       {}\n", result.get_explorer_url());
                
                if !result.mint_lock_status {
                    println!("⚠  Warning: Mint is not locked!");
                    println!("   Run: peer-token lock\n");
                }
                
                if let Some(stats) = manager.get_creation_stats() {
                    println!("Creation Cost:  {:.6} SOL", stats.total_cost_sol);
                    println!("Duration:       {}ms\n", stats.creation_duration_ms);
                }
            } else {
                println!("Status:    Created (no details available)\n");
            }
            
            info!("Status: Token created successfully");
        },
        
        TokenStatus::MintLocked => {
            if let Some(result) = manager.get_result() {
                println!("Status:         ✓ Created & Locked 🔒");
                println!("Mint Address:   {}", result.mint_address);
                println!("Total Supply:   {} PEER", result.initial_supply);
                println!("Mint Locked:    Yes ✓ (Secure)\n");
                println!("✓ Token is secure - mint authority permanently removed\n");
            } else {
                println!("Status:    Mint Locked\n");
            }
            
            info!("Status: Token locked");
        },
        
        TokenStatus::Error(ref msg) => {
            println!("Status:    ✗ Error\n");
            

            if msg.contains("insufficient funds for rent") {
                println!("Previous creation attempt failed due to metadata rent issue.");
                println!("This has been fixed in the latest code.\n");
                println!("To retry:");
                println!("  1. Reset state: RUST_ENV=development peer-token reset");
                println!("  2. Create again: peer-token create\n");
            } else {
                println!("Error: {}\n", msg);
                println!("Check logs for details: logs/peer-token-*.log\n");
            }
            
            if let Some(timestamp) = manager.get_creation_timestamp() {
                println!("Failed at: {}", format_timestamp(timestamp));
            }
            
            error!("Status: Error - {}", msg);
        }
    }
    
    Ok(())
}

fn format_timestamp(timestamp: i64) -> String {
    use chrono::{DateTime, Utc};
    let dt = DateTime::<Utc>::from_timestamp(timestamp, 0)
        .unwrap_or_else(|| Utc::now());
    dt.format("%Y-%m-%d %H:%M:%S UTC").to_string()
}


/// Lock mint permanently (irreversible)
async fn lock_mint(config: TokenConfig) -> Result<()> {
    warn!("DANGER: Initiating mint lock operation");
    warn!("WARNING: This operation is IRREVERSIBLE!");

    println!("\n╔══════════════════════════════════════════════╗");
    println!("║     ⚠ MINT LOCK (IRREVERSIBLE)              ║");
    println!("╚══════════════════════════════════════════════╝\n");

    let mut manager = TokenManager::new(config)?;


    // Show current status
    println!("\nCurrent Status:");
    info!("\nCurrent Status:");
    info!("{}", manager.get_status_report());

    // Confirm lock operation
    if !confirm_mint_lock()? {
        println!("\n⚠ Mint lock cancelled");
        info!("Mint lock cancelled by user");
        return Ok(());
    }

    println!("\n⏳ Locking mint authority...");

    match manager.lock_mint().await {
        Ok(()) => {
            println!("\n✓ Mint locked successfully!");
            println!("  No more tokens can ever be minted");
            println!("  This operation is permanent");
            info!("Mint locked successfully");
            info!("No more tokens can ever be minted");
            warn!("WARNING: This operation is permanent and cannot be undone");
        },
        Err(e) => {
            println!("\n✗ Failed to lock mint");
            println!("  Error: {}", e);
            error!("Failed to lock mint: {}", e);
            return Err(e);
        }
    }

    Ok(())
}

/// Reset token state (development only)
async fn reset_state(config: TokenConfig) -> Result<()> {
    warn!("DANGER: Resetting token state");
    
    if env::var("RUST_ENV").unwrap_or_default() == "production" {
        println!("\n✗ State reset not allowed in production!");
        error!("State reset not allowed in production environment");
        return Err(PlatformError::Token(TokenError::TransactionFailed(
            "State reset not allowed in production".to_string()
        )));
    }

    // let config = TokenConfig::load()?;
    println!("\n╔══════════════════════════════════════════════╗");
    println!("║     ⚠ STATE RESET (DEVELOPMENT ONLY)        ║");
    println!("╚══════════════════════════════════════════════╝\n");
    let mut manager = TokenManager::new(config)?;

    if !confirm_state_reset()? {
        println!("\n⚠ Reset cancelled");
        info!("State reset cancelled by user");
        return Ok(());
    }

    manager.reset_state()?;
    println!("\n✓ State reset successfully!");
    println!("  You can now create a new token");
    info!("Token state reset successfully");

    Ok(())
}



/// Confirm token creation with user
fn confirm_creation() -> Result<bool> {
    println!("\nTOKEN CREATION CONFIRMATION");
    println!("════════════════════════════════");
    println!("This will create a new PEER token on the blockchain.");
    println!("This operation costs SOL and can only be done ONCE.");
    println!("\nProceed with token creation? (yes/no): ");

    let mut input = String::new();
    std::io::stdin().read_line(&mut input)
        .map_err(|e| PlatformError::Internal(anyhow::anyhow!("Failed to read input: {}", e)))?;

    Ok(input.trim().to_lowercase() == "yes")
}

/// Confirm mint lock operation
fn confirm_mint_lock() -> Result<bool> {
    println!("\nMINT LOCK CONFIRMATION");
    println!("═══════════════════════════");
    println!("This will PERMANENTLY lock the mint authority.");
    println!("After this operation:");
    println!("No more tokens can EVER be minted");
    println!("This action is IRREVERSIBLE");
    println!("The mint authority will be removed forever");
    println!("\nType 'LOCK' to confirm permanent mint lock: ");

    let mut input = String::new();
    std::io::stdin().read_line(&mut input)
        .map_err(|e| PlatformError::Internal(anyhow::anyhow!("Failed to read input: {}", e)))?;

    Ok(input.trim() == "LOCK")
}

/// Confirm state reset (development only)
fn confirm_state_reset() -> Result<bool> {
    println!("\nSTATE RESET CONFIRMATION");
    println!("═══════════════════════════");
    println!("This will reset the token state to allow creation again.");
    println!("This should only be used in development/testing.");
    println!("\nType 'RESET' to confirm state reset: ");

    let mut input = String::new();
    std::io::stdin().read_line(&mut input)
        .map_err(|e| PlatformError::Internal(anyhow::anyhow!("Failed to read input: {}", e)))?;

    Ok(input.trim() == "RESET")
}

