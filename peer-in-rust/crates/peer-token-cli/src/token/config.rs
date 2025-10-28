
use serde::{Deserialize, Serialize};
use solana_sdk::signature::Signer;
use tracing::{info, instrument};

use peer_common::utils::errors::{Result, PlatformError, TokenError};
use crate::token::loader::TokenConfigLoader;

 
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenConfig {
    //.env
    pub admin_keypair_path: String, 
    pub rpc_url: String,
    // Constansts 
    pub token_name: String,
    pub token_symbol: String,
    pub token_decimals: u8,
    pub initial_supply: u64,
    pub token_description: String,
    pub token_image_uri: String,
    pub mint_authority_seed: String,
    //TOML
    pub cluster: String, 
    pub commitment_level: String,
    pub transaction_timeout: u64,
    pub max_retries: u32,
    // Constants 
    pub token_website: Option<String>,
    pub token_twitter: Option<String>,
    pub token_telegram: Option<String>,
    pub token_discord: Option<String>,
}

impl TokenConfig {
    /// Load token configuration 
    /// 
    /// Flow:
    /// 1. loader.rs - Load files and build Config object
    /// 2. config.rs - Deserialize Config to strongly-typed struct  
    /// 3. validator.rs - Validate business rules and constraints
    pub fn load() -> Result<Self> {

        let loader = TokenConfigLoader::new();
        let config = loader.build()?;

        info!("Token configuration loaded: {:?}", config);
        
        // Deserialize to strongly-typed struct
        let token_config: Self = config.try_deserialize()
            .map_err(|e| PlatformError::Token(TokenError::TransactionFailed(
                format!("Failed to deserialize token config: {}", e)
            )))?;
        
        crate::token::TokenValidator::validate_config(&token_config)?;
        
        info!(" Token configuration loaded and validated successfully");
        Ok(token_config)
    }

    #[instrument(skip(self))]
    pub fn load_admin_keypair(&self) -> Result<solana_sdk::signature::Keypair> {
        info!(" Loading admin keypair from: {}", self.admin_keypair_path);

        if !std::path::Path::new(&self.admin_keypair_path).exists() {
            return Err(PlatformError::Token(TokenError::KeypairNotFound(
                self.admin_keypair_path.clone()
            )));
        }

        let key_data = std::fs::read_to_string(&self.admin_keypair_path)
            .map_err(|e| PlatformError::Token(TokenError::KeypairReadError(
                format!("Failed to read {}: {}", self.admin_keypair_path, e)
            )))?;

        let key_bytes: Vec<u8> = serde_json::from_str(&key_data)
            .map_err(|e| PlatformError::Token(TokenError::KeypairParseError(
                format!("Failed to parse keypair JSON: {}", e)
            )))?;

        if key_bytes.len() != 64 {
            return Err(PlatformError::Token(TokenError::InvalidKeypairLength(
                key_bytes.len()
            )));
        }

        let keypair = solana_sdk::signature::Keypair::try_from(key_bytes.as_slice())
            .map_err(|e| PlatformError::Token(TokenError::KeypairCreationError(
                format!("Failed to create keypair: {}", e)
            )))?;

        info!("Admin keypair loaded: {}", keypair.pubkey());
        Ok(keypair)
    }

    pub fn get_minimum_balance_requirement(&self) -> u64 {
        20_000_000 
    }

    pub fn get_token_amount_with_decimals(&self) -> Result<u64> {
        self.initial_supply
            .checked_mul(10_u64.pow(self.token_decimals as u32))
            .ok_or_else(|| PlatformError::Token(TokenError::SupplyOverflow))
    }

  
    pub fn get_summary(&self) -> String {
        format!(
            "Token: {} ({}) | Supply: {} | Decimals: {} | Cluster: {}",
            self.token_name,
            self.token_symbol,
            self.initial_supply,
            self.token_decimals,
            self.cluster
        )
    }
}
