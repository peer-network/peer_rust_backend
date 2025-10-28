

use solana_sdk::pubkey::Pubkey;
use std::path::Path;
use tracing::{info, warn, debug, instrument};
use peer_common::utils::errors::{Result, PlatformError, TokenError};
use crate::token::types::{TokenCreationRequest, TokenStatus};
use crate::token::config::TokenConfig;

pub struct TokenValidator;

impl TokenValidator {
   
    #[instrument(skip(config))]
    pub fn validate_config(config: &TokenConfig) -> Result<()> {
        info!(" Validating token configuration (environment values)");

        // Validate sensitive environment values
        Self::validate_admin_keypair_path(&config.admin_keypair_path)?;
        Self::validate_rpc_url(&config.rpc_url)?;
        Self::validate_mint_authority_seed(&config.mint_authority_seed)?;
        Self::validate_cluster(&config.cluster)?;
        
        // Validate optional social links 
        Self::validate_optional_social_links(config)?;

        // Validate operational values 
        Self::validate_transaction_timeout(config.transaction_timeout)?;
        Self::validate_max_retries(config.max_retries)?;

        info!(" Token configuration validation passed");
        Ok(())
    }

    /// Validate admin keypair file path exists and is accessible
    #[instrument]
    pub fn validate_admin_keypair_path(path: &str) -> Result<()> {
        debug!(" Validating admin keypair path: '{}'", path);

        if path.is_empty() {
            return Err(PlatformError::Token(TokenError::KeypairNotFound(
                "ADMIN_KEYPAIR_PATH cannot be empty".to_string()
            )));
        }

        if !Path::new(path).exists() {
            return Err(PlatformError::Token(TokenError::KeypairNotFound(
                format!("Admin keypair file not found: {} (check ADMIN_KEYPAIR_PATH)", path)
            )));
        }

        // Validate file permissions (should be readable)
        let metadata = std::fs::metadata(path)
            .map_err(|e| PlatformError::Token(TokenError::KeypairReadError(
                format!("Cannot read keypair file metadata: {}", e)
            )))?;

        if !metadata.is_file() {
            return Err(PlatformError::Token(TokenError::KeypairNotFound(
                format!("Keypair path is not a file: {}", path)
            )));
        }

        debug!(" Admin keypair path validation passed");
        Ok(())
    }

    /// Validate mint authority seed
    #[instrument]
    pub fn validate_mint_authority_seed(seed: &str) -> Result<()> {
        debug!(" Validating mint authority seed length");

        if seed.is_empty() {
            return Err(PlatformError::Token(TokenError::InvalidSeed(
                "MINT_AUTHORITY_SEED cannot be empty".to_string()
            )));
        }

        if seed.len() > 32 {
            return Err(PlatformError::Token(TokenError::InvalidSeed(
                format!("Mint authority seed too long: {} chars (max 32)", seed.len())
            )));
        }

        // Check for valid characters (alphanumeric + underscore)
        if !seed.chars().all(|c| c.is_alphanumeric() || c == '_') {
            return Err(PlatformError::Token(TokenError::InvalidSeed(
                "Mint authority seed must be alphanumeric or underscore only".to_string()
            )));
        }

        debug!(" Mint authority seed validation passed");
        Ok(())
    }

    /// Validate RPC URL format and basic structure
    #[instrument]
    pub fn validate_rpc_url(rpc_url: &str) -> Result<()> {
        debug!(" Validating RPC URL: {}", rpc_url);

        if rpc_url.is_empty() {
            return Err(PlatformError::InvalidInput(
                "SOLANA_RPC_URL cannot be empty".to_string()
            ));
        }

        if !rpc_url.starts_with("http://") && !rpc_url.starts_with("https://") {
            return Err(PlatformError::InvalidInput(
                "SOLANA_RPC_URL must start with http:// or https://".to_string()
            ));
        }

        // Basic URL validation
        if rpc_url.len() < 10 || !rpc_url.contains('.') {
            return Err(PlatformError::InvalidInput(
                "Invalid SOLANA_RPC_URL format".to_string()
            ));
        }


        if rpc_url.starts_with("http://") && !rpc_url.contains("localhost") && !rpc_url.contains("127.0.0.1") {
            warn!("  Using insecure HTTP RPC URL : {}", rpc_url);
        }

        debug!(" RPC URL validation passed");
        Ok(())
    }

    /// Validate Solana cluster name
    #[instrument]
    pub fn validate_cluster(cluster: &str) -> Result<()> {
        debug!(" Validating cluster: {}", cluster);

        match cluster.to_lowercase().as_str() {
            "devnet" | "testnet" | "mainnet-beta" | "mainnet" | "custom" => {
                debug!(" Valid cluster: {}", cluster);
                Ok(())
            }
            _ => {
                warn!(" Unknown cluster type: {} (valid: devnet, testnet, mainnet-beta, custom)", cluster);
                // Don't fail validation for custom clusters
                Ok(())
            }
        }
    }

    /// Validate optional social links (environment-loaded)
    #[instrument(skip(config))]
    pub fn validate_optional_social_links(config: &TokenConfig) -> Result<()> {
        debug!(" Validating optional social links");

        if let Some(website) = &config.token_website {
            Self::validate_website_url(website, "TOKEN_WEBSITE")?;
        }

        if let Some(twitter) = &config.token_twitter {
            Self::validate_twitter_url(twitter)?;
        }

        if let Some(telegram) = &config.token_telegram {
            Self::validate_telegram_url(telegram)?;
        }

        if let Some(discord) = &config.token_discord {
            Self::validate_discord_url(discord)?;
        }

        debug!(" Social links validation passed");
        Ok(())
    }

    /// Validate website URL format
    #[instrument]
    pub fn validate_website_url(url: &str, field_name: &str) -> Result<()> {
        if url.is_empty() {
            return Ok(()); 
        }

        if !url.starts_with("http://") && !url.starts_with("https://") {
            return Err(PlatformError::InvalidInput(
                format!("{} must start with http:// or https://", field_name)
            ));
        }

        if url.len() > 200 {
            return Err(PlatformError::InvalidInput(
                format!("{} too long (max 200 chars)", field_name)
            ));
        }

        Ok(())
    }

    /// Validate Twitter URL format
    #[instrument]
    pub fn validate_twitter_url(url: &str) -> Result<()> {
        if url.is_empty() {
            return Ok(());
        }

        if !url.contains("twitter.com") && !url.contains("x.com") {
            return Err(PlatformError::InvalidInput(
                "TOKEN_TWITTER must be a twitter.com or x.com URL".to_string()
            ));
        }

        Self::validate_website_url(url, "TOKEN_TWITTER")
    }

    /// Validate Telegram URL format
    #[instrument]
    pub fn validate_telegram_url(url: &str) -> Result<()> {
        if url.is_empty() {
            return Ok(());
        }

        if !url.contains("t.me") {
            return Err(PlatformError::InvalidInput(
                "TOKEN_TELEGRAM must be a t.me URL".to_string()
            ));
        }

        Self::validate_website_url(url, "TOKEN_TELEGRAM")
    }

    /// Validate Discord URL format
    #[instrument]
    pub fn validate_discord_url(url: &str) -> Result<()> {
        if url.is_empty() {
            return Ok(());
        }

        if !url.contains("discord.gg") && !url.contains("discord.com") {
            return Err(PlatformError::InvalidInput(
                "TOKEN_DISCORD must be a discord.gg or discord.com URL".to_string()
            ));
        }

        Self::validate_website_url(url, "TOKEN_DISCORD")
    }

    /// Validate transaction timeout value
    #[instrument]
    pub fn validate_transaction_timeout(timeout: u64) -> Result<()> {
        debug!(" Validating transaction timeout: {} seconds", timeout);

        if timeout == 0 {
            return Err(PlatformError::InvalidInput(
                "Transaction timeout cannot be 0".to_string()
            ));
        }

        if timeout > 300 {
            warn!(" Very long transaction timeout: {} seconds (consider reducing)", timeout);
        }

        debug!(" Transaction timeout validation passed");
        Ok(())
    }

    /// Validate max retries value
    #[instrument]
    pub fn validate_max_retries(retries: u32) -> Result<()> {
        debug!(" Validating max retries: {}", retries);

        if retries > 10 {
            warn!(" Very high retry count: {} (may cause long delays)", retries);
        }

        debug!(" Max retries validation passed");
        Ok(())
    }

    /// Validate token creation request (for user input)
    #[instrument(skip(request))]
    pub fn validate_creation_request(request: &TokenCreationRequest) -> Result<()> {
        info!("  Validating token creation request");

        Self::validate_admin_pubkey(&request.admin_pubkey)?;

        info!(" Token creation request validation passed");
        Ok(())
    }

    /// Validate admin public key format
    #[instrument]
    pub fn validate_admin_pubkey(pubkey_str: &str) -> Result<()> {
        debug!(" Validating admin pubkey format");

        let _pubkey: Pubkey = pubkey_str.parse()
            .map_err(|e| PlatformError::InvalidInput(
                format!("Invalid admin pubkey format: {}", e)
            ))?;

        debug!(" Admin pubkey validation passed");
        Ok(())
    }

    /// Validate that token creation can proceed
    #[instrument]
    pub fn validate_can_create_token(status: &TokenStatus) -> Result<()> {
        info!(" Validating token creation eligibility");

        match status {
            TokenStatus::NotCreated => {
                info!(" Token creation can proceed");
                Ok(())
            },
            TokenStatus::Created => {
                warn!(" Token already created but not locked");
                Err(PlatformError::Token(TokenError::TokenAlreadyExists))
            },
            TokenStatus::MintLocked => {
                warn!(" Token already exists and mint is locked");
                Err(PlatformError::Token(TokenError::TokenAlreadyExists))
            },
            TokenStatus::Error(msg) => {
                warn!(" Token in error state: {}", msg);
                Err(PlatformError::Token(TokenError::TransactionFailed(msg.clone())))
            }
        }
    }

    /// Validate minimum balance for token creation
    #[instrument]
    pub fn validate_minimum_balance(current_balance: u64, required_balance: u64) -> Result<()> {
        debug!(" Validating balance: {} SOL required, {} SOL available", 
               required_balance as f64 / 1_000_000_000.0,
               current_balance as f64 / 1_000_000_000.0);

        if current_balance < required_balance {
            return Err(PlatformError::Token(TokenError::InsufficientBalance));
        }

        info!(" Sufficient balance for token creation");
        Ok(())
    }

    /// Get validation summary for logging
    pub fn get_validation_summary(config: &TokenConfig) -> String {
        format!(
            "Token Configuration Validation Summary:\n\
             Admin Keypair: {}\n\
             RPC URL: {}\n\
             Cluster: {}\n\
             Mint Seed: {} chars\n\
             Social Links: {}",
            config.admin_keypair_path,
            config.rpc_url,
            config.cluster,
            config.mint_authority_seed.len(),
            Self::format_social_links(config)
        )
    }

    /// Format social links for summary
    fn format_social_links(config: &TokenConfig) -> String {
        let mut links = Vec::new();
        
        if config.token_website.is_some() { links.push("Website"); }
        if config.token_twitter.is_some() { links.push("Twitter"); }
        if config.token_telegram.is_some() { links.push("Telegram"); }
        if config.token_discord.is_some() { links.push("Discord"); }

        if links.is_empty() {
            "None".to_string()
        } else {
            links.join(", ")
        }
    }
}
