
mod peer_token;

use anyhow::{anyhow, Result};
use dotenv::dotenv;
use log::info;
use solana_sdk::signature::{Keypair, Signer};
use std::{env, fs, path::Path};

#[derive(Debug)]
pub struct ProductionConfig {
    pub admin_keypair: Keypair,
    pub admin_pubkey: String,
    pub rpc_url: String,
    pub token_name: String,
    pub token_symbol: String,
    pub token_decimals: u8,
    pub initial_supply: u64,
}

impl ProductionConfig {
    fn load() -> Result<Self> {
        // Load .env file
        dotenv().ok();

        // Load admin keypair from keys/admin.json ONLY
        let admin_keypair = Self::load_admin_keypair()?;
        
        let config = Self {
            admin_pubkey: admin_keypair.pubkey().to_string(),
            admin_keypair,
            rpc_url: env::var("SOLANA_RPC_URL")
                .unwrap_or_else(|_| "https://api.devnet.solana.com".to_string()),
            token_name: env::var("PEER_TOKEN_NAME")
                .unwrap_or_else(|_| "PEER Social Token".to_string()),
            token_symbol: env::var("PEER_TOKEN_SYMBOL")
                .unwrap_or_else(|_| "PEER".to_string()),
            token_decimals: env::var("PEER_TOKEN_DECIMALS")
                .unwrap_or_else(|_| "9".to_string())
                .parse()
                .map_err(|_| anyhow!("Invalid TOKEN_DECIMALS"))?,
            initial_supply: env::var("PEER_INITIAL_SUPPLY")
                .unwrap_or_else(|_| "19500000".to_string())
                .parse()
                .map_err(|_| anyhow!("Invalid INITIAL_SUPPLY"))?,
        }; 

        config.validate()?;
        Ok(config)
    }

    fn load_admin_keypair() -> Result<Keypair> {
        let admin_path = env::var("ADMIN_KEYPAIR_PATH")
        .unwrap_or_else(|_| "keys/admin.json".to_string());

        if !Path::new(&admin_path).exists() {
            return Err(anyhow!(
                "Admin keypair not found at: {}\nCreate the file with your private key JSON array",
                admin_path
            ));
        }

        info!("Loading admin keypair from: {}", admin_path);
        
        //reading file 
        let key_data = fs::read_to_string(&admin_path)
            .map_err(|e| anyhow!("Failed to read {}: {}", admin_path, e))?;

        let key_bytes: Vec<u8> = serde_json::from_str(&key_data)
            .map_err(|e| anyhow!("Failed to parse admin keypair JSON: {}", e))?;

        if key_bytes.len() != 64 {
            return Err(anyhow!("Invalid keypair length: expected 64 bytes, got {}", key_bytes.len()));
        }

        Keypair::try_from(&key_bytes[..])
            .map_err(|e| anyhow!("Failed to create keypair: {}", e))
    }

    fn validate(&self) -> Result<()> {
        if self.token_name.is_empty() || self.token_name.len() > 32 {
            return Err(anyhow!("Token name must be 1-32 characters"));
        }
        if self.token_symbol.is_empty() || self.token_symbol.len() > 10 {
            return Err(anyhow!("Token symbol must be 1-10 characters"));
        }
        if self.token_decimals > 9 {
            return Err(anyhow!("Token decimals cannot exceed 9"));
        }
        if self.initial_supply == 0 {
            return Err(anyhow!("Initial supply must be greater than 0"));
        }
        
        info!(" Production configuration validated");
        Ok(())
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logging
    env_logger::Builder::from_default_env()
        .filter_level(log::LevelFilter::Info)
        .init();

    info!(" PEER Token Set-Up");
    info!("═══════════════════════════════════");
    
    // Load production configuration
    let config = ProductionConfig::load()?;
    info!("  Configuration loaded successfully");
    info!("  Admin: {}", config.admin_pubkey);
    info!("  RPC: {}", config.rpc_url);

    // Create PEER token
    let creator = peer_token::PeerTokenCreator::new(&config.rpc_url);
    // info!(" creator: {} ", creator);
    // Check admin balance
    let balance = creator.get_balance(&config.admin_keypair.pubkey()).await?;
    info!(" Admin Balance: {} SOL", balance as f64 / 1_000_000_000.0);
    
    if balance < 20_000_000 { // 0.02 SOL minimum
        return Err(anyhow!(
            "Insufficient balance. Need at least 0.02 SOL, have {} SOL",
            balance as f64 / 1_000_000_000.0
        ));
    }

    // Create PEER token
    let result = creator.create_peer_token(&config).await?;

    info!("\n PEER Token Created Successfully!");
    info!("═══════════════════════════════════");
    info!("  Mint Address: {}", result.mint_address);
    info!("  Mint Authority: {}", result.mint_authority);
    info!("  Admin Token Account: {}", result.admin_token_account);
    info!("  Initial Supply: {} PEER", result.initial_supply);
    
    info!("\n  Verify on Explorer:");
    let cluster = if config.rpc_url.contains("devnet") { "?cluster=devnet" } else { "" };
    info!("   {}/address/{}{}", "https://explorer.solana.com", result.mint_address, cluster);

    info!("\n Save for Production:");
    info!("   PEER_MINT_ADDRESS={}", result.mint_address);
    info!("   ADMIN_TOKEN_ACCOUNT={}", result.admin_token_account);

    Ok(())
}



