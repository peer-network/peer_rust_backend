/// Global Structs to load Config 

use serde::{Deserialize, Serialize};
use crate::utils::errors::{Result, PlatformError, ConfigError};
use crate::config::loader::{ConfigLoader, ConfigStats};



#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformConfig {
    pub server: ServerConfig,
    pub solana: SolanaConfig,
    pub security: SecurityConfig,
    pub cashout: CashoutConfig,
    pub logging: LoggingConfig,
    pub database: DatabaseConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub workers: Option<usize>,
    // pub enable_playground: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolanaConfig {
    pub rpc_url: String,
    pub cluster: String,
    pub peer_mint_address: Option<String>,
    pub company_token_account: Option<String>,
    pub admin_keypair_path: String,
    pub user_keypair_path: Option<String>,
    pub gas_wallet_address: Option<String>,  
    pub commitment: Option<String>, 
    pub timeout: Option<u64>,       
    pub max_retries: Option<u32>,   
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityConfig {
    pub rate_limit_rpm: u32,
    pub api_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CashoutConfig {
    pub max_amount: u64,
    pub min_amount: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggingConfig {
    pub level: String,
    pub file_path: String,
    pub format: String,
    pub enable_tracing: bool,
    pub rotation: Option<String> 
}

// #[cfg(feature = "database")]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub db_name: String,
    pub max_connections: u32,
    pub min_connections: u32,
}

impl PlatformConfig {

    /// Flow:
    ///  -> loader.rs - Load files and build Config object
    ///  -> platform.rs - Deserialize Config to strongly-typed struct  
    ///  -> validator.rs - Validate  rules and constraints
    pub fn load() -> Result<Self> {

        //  Load configuration files 
        let loader = ConfigLoader::new();
        let config = loader.build()?;
        
        
        // Deserialize to strongly-typed struct 
        let platform_config: Self = config.try_deserialize()
            .map_err(|e| PlatformError::Config(
                ConfigError::ConfigLoadError(e.to_string())
            ))?;
        
        // after deserializing to struct , Validate the structs 
        crate::config::validator::ConfigValidator::validate(&platform_config)?;
        
        tracing::info!("Launching Platform configuration loaded and validated successfully");
        Ok(platform_config)
    }

    /// Get configuration loading statistics for debugging
    pub fn get_loader_stats() -> Result<ConfigStats> {
        let loader = ConfigLoader::new();
        Ok(loader.get_stats())
    }
}
