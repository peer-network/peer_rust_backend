use crate::config::platform::*;
use crate::utils::{constants::*, errors::*};
use crate::utils::errors::ConfigError;
use tracing::{info, warn, debug};
use std::path::Path;



// -> Flow 
// after the deserilaize struct in the platform.rs here config feilds will be validated 
// NOTE: Validation is not neccessary , only to get rid of errors at runtime while transaction are being processed on the Blockchain
pub struct ConfigValidator;

impl ConfigValidator {

    pub fn validate(config: &PlatformConfig) -> Result<()> {
        info!(" Validating platform configuration");
        
        //  Validate server configuration
        Self::validate_server_config(&config.server)?;
        
        //  Validate Solana configuration  
        Self::validate_solana_config(&config.solana)?;
        
        //  Validate security configuration
        Self::validate_security_config(&config.security)?;
        
        //  Validate cashout configuration
        Self::validate_cashout_config(&config.cashout)?;
        
        //  Validate logging configuration
        Self::validate_logging_config(&config.logging)?;
        
        //  Validate database configuration
        Self::validate_database_config(&config.database)?;
        
        info!(" Configuration validation passed");
        Ok(())
    }

   
    
    fn validate_server_config(server: &ServerConfig) -> Result<()> {
        debug!(" Validating server configuration");

        // Validate port range
        if server.port == 0 {
            return Err(PlatformError::Config(ConfigurationError::ValidationError {
                field: "server.port".to_string(),
                reason: "Port cannot be 0".to_string()
            }));
        }

        // Specific port validation  
        let env = std::env::var("RUST_ENV").unwrap_or_else(|_| "development".to_string());
        if env == "production" && server.port < 1024 {
            return Err(PlatformError::Config(ConfigurationError::ValidationError {
                field: "server.port".to_string(),
                reason: "Port < 1024 requires root privileges in production".to_string()
            }));
        }

        // Validate host format
        if server.host.is_empty() {
            return Err(PlatformError::Config(ConfigurationError::ValidationError {
                field: "server.host".to_string(),
                reason: "Host cannot be empty".to_string()
            }));
        }

        // Validate worker count
        if let Some(workers) = server.workers {
            if workers == 0 {
                return Err(PlatformError::Config(ConfigurationError::ValidationError {
                    field: "server.workers".to_string(),
                    reason: "Worker count cannot be 0".to_string()
                }));
            }
            if workers > 32 {
                warn!(" High worker count ({}) may impact performance", workers);
            }
        }

        debug!(" Server configuration validated");
        Ok(())
    }

    /// Validate Solana configuration rules
    fn validate_solana_config(solana: &SolanaConfig) -> Result<()> {
        debug!(" Validating Solana configuration");

        // Validate RPC URL format
        if !solana.rpc_url.starts_with("http://") && !solana.rpc_url.starts_with("https://") {
            return Err(PlatformError::Config(ConfigurationError::ValidationError {
                field: "solana.rpc_url".to_string(),
                reason: "RPC URL must start with http:// or https://".to_string()
            }));
        }

        // Validate cluster
        match solana.cluster.as_str() {
            "devnet" | "testnet" | "mainnet-beta" => {},
            _ => {
                return Err(PlatformError::Config(ConfigurationError::ValidationError {
                    field: "solana.cluster".to_string(),
                    reason: format!("Invalid cluster '{}'. Must be: devnet, testnet, or mainnet-beta", solana.cluster)
                }));
            }
        }

        // Validate commitment level
        if let Some(ref commitment) = solana.commitment {
            match commitment.as_str() {
                "processed" | "confirmed" | "finalized" => {},
                _ => {
                    return Err(PlatformError::Config(ConfigurationError::ValidationError {
                        field: "solana.commitment".to_string(),
                        reason: format!("Invalid commitment '{}'. Must be: processed, confirmed, or finalized", commitment)
                    }));
                }
            }
        }

        // Validate company keypair path exists
        let keypair_path = Path::new(&solana.admin_keypair_path);
        if !keypair_path.exists() {
            return Err(PlatformError::Config(ConfigurationError::FileNotFound {
                file_path: solana.admin_keypair_path.clone()
            }));
        }

        // Validate timeout range
        if let Some(timeout) = solana.timeout {
            if timeout == 0 {
                return Err(PlatformError::Config(ConfigurationError::ValidationError {
                    field: "solana.timeout".to_string(),
                    reason: "Timeout cannot be 0".to_string()
                }));
            }
            if timeout > 300 {
                warn!(" Very high timeout ({} seconds) may cause performance issues", timeout);
            }
        }

        debug!(" Solana configuration validated");
        Ok(())
    }

    /// Validate security configuration 
    fn validate_security_config(security: &SecurityConfig) -> Result<()> {
        debug!(" Validating security configuration");

        // Validate rate limit
        if security.rate_limit_rpm == 0 {
            return Err(PlatformError::Config(ConfigurationError::ValidationError {
                field: "security.rate_limit_rpm".to_string(),
                reason: "Rate limit cannot be 0".to_string()
            }));
        }

        // Validate API key if present
        if let Some(ref api_key) = security.api_key {
            if api_key.len() < MIN_API_KEY_LENGTH {
                return Err(PlatformError::Config(ConfigurationError::ValidationError {
                    field: "security.api_key".to_string(),
                    reason: format!("API key must be at least {} characters", MIN_API_KEY_LENGTH)
                }));
            }
            if api_key.len() > MAX_API_KEY_LENGTH {
                return Err(PlatformError::Config(ConfigurationError::ValidationError {
                    field: "security.api_key".to_string(),
                    reason: format!("API key cannot exceed {} characters", MAX_API_KEY_LENGTH)
                }));
            }
        } else {
            // Check environment for API key
            if let Ok(env_api_key) = std::env::var("SECURITY_API_KEY") {
                if env_api_key.len() < MIN_API_KEY_LENGTH {
                    return Err(PlatformError::Config(ConfigurationError::ValidationError {
                        field: "SECURITY_API_KEY".to_string(),
                        reason: format!("API key must be at least {} characters", MIN_API_KEY_LENGTH)
                    }));
                }
            }
        }

        debug!(" Security configuration validated");
        Ok(())
    }

    /// Validate cashout configuration 
    fn validate_cashout_config(cashout: &CashoutConfig) -> Result<()> {
        debug!(" Validating cashout configuration");

        // Validate min/max relationship
        if cashout.min_amount >= cashout.max_amount {
            return Err(PlatformError::Config(ConfigurationError::ValidationError {
                field: "cashout.amounts".to_string(),
                reason: format!(
                    "min_amount ({}) must be less than max_amount ({})",
                    cashout.min_amount, 
                    cashout.max_amount
                )
            }));
        }

        // Validate reasonable limits
        if cashout.min_amount == 0 {
            return Err(PlatformError::Config(ConfigurationError::ValidationError {
                field: "cashout.min_amount".to_string(),
                reason: "Minimum cashout amount cannot be 0".to_string()
            }));
        }

        // Warn about extreme values
        if cashout.max_amount > 1_000_000_000 {
            warn!(" Very high max cashout amount: {}", cashout.max_amount);
        }

        debug!(" Cashout configuration validated");
        Ok(())
    }

    /// Validate logging configuration business rules
    fn validate_logging_config(logging: &LoggingConfig) -> Result<()> {
        debug!(" Validating logging configuration");

        // Validate log level
        match logging.level.to_lowercase().as_str() {
            "error" | "warn" | "info" | "debug" | "trace" => {},
            _ => {
                return Err(PlatformError::Config(ConfigurationError::ValidationError {
                    field: "logging.level".to_string(),
                    reason: format!("Invalid log level '{}'. Must be: error, warn, info, debug, or trace", logging.level)
                }));
            }
        }

        // Validate log format
        match logging.format.to_lowercase().as_str() {
            "json" | "pretty" | "compact" => {},
            _ => {
                return Err(PlatformError::Config(ConfigurationError::ValidationError {
                    field: "logging.format".to_string(),
                    reason: format!("Invalid log format '{}'. Must be: json, pretty, or compact", logging.format)
                }));
            }
        }

        // Validate log file path 
        let log_path = Path::new(&logging.file_path);
        if let Some(parent) = log_path.parent() {
            if !parent.exists() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| PlatformError::Config(ConfigurationError::ValidationError {
                        field: "logging.file_path".to_string(),
                        reason: format!("Cannot create log directory: {}", e)
                    }))?;
            }
        }

        // Validate rotation if specified
        if let Some(ref rotation) = logging.rotation {
            match rotation.to_lowercase().as_str() {
                "daily" | "hourly" | "never" => {},
                _ => {
                    return Err(PlatformError::Config(ConfigurationError::ValidationError {
                        field: "logging.rotation".to_string(),
                        reason: format!("Invalid rotation '{}'. Must be: daily, hourly, or never", rotation)
                    }));
                }
            }
        }

        debug!(" Logging configuration validated");
        Ok(())
    }

    /// Validate database configuration
    fn validate_database_config(database: &DatabaseConfig) -> Result<()> {
        debug!(" Validating database configuration");

        // Validate host
        if database.host.is_empty() {
            return Err(PlatformError::Config(ConfigurationError::ValidationError {
                field: "database.host".to_string(),
                reason: "Database host cannot be empty".to_string()
            }));
        }

        // Validate port
        if database.port == 0 {
            return Err(PlatformError::Config(ConfigurationError::ValidationError {
                field: "database.port".to_string(),
                reason: "Database port cannot be 0".to_string()
            }));
        }

        // Validate username
        if database.username.is_empty() {
            return Err(PlatformError::Config(ConfigurationError::ValidationError {
                field: "database.username".to_string(),
                reason: "Database username cannot be empty".to_string()
            }));
        }

        // Validate password
        if database.password.is_empty() {
            return Err(PlatformError::Config(ConfigurationError::ValidationError {
                field: "database.password".to_string(),
                reason: "Database password cannot be empty (set DATABASE_PASSWORD in .env)".to_string()
            }));
        }

        // Validate database name
        if database.db_name.is_empty() {
            return Err(PlatformError::Config(ConfigurationError::ValidationError {
                field: "database.db_name".to_string(),
                reason: "Database name cannot be empty".to_string()
            }));
        }

        // Validate connection pool settings
        if database.max_connections == 0 {
            return Err(PlatformError::Config(ConfigurationError::ValidationError {
                field: "database.max_connections".to_string(),
                reason: "Max connections must be greater than 0".to_string()
            }));
        }

        if database.min_connections > database.max_connections {
            return Err(PlatformError::Config(ConfigurationError::ValidationError {
                field: "database.min_connections".to_string(),
                reason: "Min connections cannot exceed max connections".to_string()
            }));
        }

        debug!(" Database configuration validated");
        Ok(())
    }
}

