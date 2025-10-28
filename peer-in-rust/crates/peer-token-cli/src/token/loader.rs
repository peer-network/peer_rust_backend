use config::{Config, Environment, File, FileFormat};
use std::path::Path;
use tracing::{info, warn, debug, instrument};
use std::time::Instant;
// use peer_common::utils::errors::{Result, PlatformError, TokenError, ConfigurationError};
use peer_common::utils::constants::*;
use peer_common::utils::errors::*;


#[derive(Debug)]
pub struct TokenConfigLoader {
    environment: String,
    load_start_time: Instant,
}

impl TokenConfigLoader {

    pub fn new() -> Self {
        let environment = Self::detect_environment();
        info!(" TokenConfigLoader initialized for environment: {}", environment);
        
        Self {
            environment,
            load_start_time: Instant::now(),
        }
    }

  
    #[instrument(skip(self), fields(env = %self.environment))]
    pub fn build(&self) -> Result<Config> {
        info!(" Loading token configuration files");
        let start_time = Instant::now();

        let config = self.build_config_sources()?;

        let duration = start_time.elapsed();
        info!(" Token configuration files loaded in {:?}", duration);
        
        Ok(config)
    }

    fn detect_environment() -> String {
        match std::env::var("RUST_ENV") {
            Ok(env) => {
                let env = env.to_lowercase();
                match env.as_str() {
                    "production" | "prod" => PRODUCTION_ENV.to_string(),
                    "development" | "dev" => DEVELOPMENT_ENV.to_string(),
                    "local" => LOCAL_ENV.to_string(),
                    _ => {
                        warn!(" Unknown RUST_ENV '{}', defaulting to 'development'", env);
                        DEFAULT_ENVIRONMENT.to_string()
                    }
                }
            },
            Err(_) => {
                debug!(" RUST_ENV not set, defaulting to '{}'", DEFAULT_ENVIRONMENT);
                DEFAULT_ENVIRONMENT.to_string()
            }
        }
    }

    #[instrument(skip(self))]
    fn build_config_sources(&self) -> Result<Config> {
        debug!(" Building token configuration sources");

        let mut builder = Config::builder();

        builder = builder.add_source(self.build_safe_defaults()); 

        builder = self.add_toml_sources(builder)?;

        builder = builder.add_source(
            Environment::default()
                // .separator("_")
                .try_parsing(true)
        );

        let config = builder.build()
            .map_err(|e| PlatformError::Config(ConfigurationError::ConfigLoadError(e.to_string())))?;

        debug!(" Token configuration sources built successfully");
        Ok(config)
    }

    fn add_toml_sources(&self, mut builder: config::ConfigBuilder<config::builder::DefaultState>) -> Result<config::ConfigBuilder<config::builder::DefaultState>> {
        let toml_file = self.get_toml_file_for_environment();
        let toml_path = Path::new(&toml_file);
        if toml_path.exists() {
            info!(" Loading existing TOML config: {}", toml_file);
            
            if !toml_path.is_file() {
            warn!(" {} exists but is not a file", toml_file);
            return Ok(builder);
            }

            builder = builder.add_source(
                File::with_name(&toml_file)
                    .format(FileFormat::Toml)
                    .required(false)
            );

            debug!(" TOML config loaded successfully");
        } else {
            debug!(" TOML file not found: {}", toml_file);
        }

        Ok(builder)
    }

    fn get_toml_file_for_environment(&self) -> String {
        match self.environment.as_str() {
            "production" => "config/production.toml".to_string(),
            "development" => "config/development.toml".to_string(),
            _ => "config/development.toml".to_string(),
        }
    }

    fn build_safe_defaults(&self) -> Config {
        debug!(" Building safe token defaults from constants");
        
        Config::builder()

            .set_default("token_name", TOKEN_NAME).unwrap()
            .set_default("token_symbol", TOKEN_SYMBOL).unwrap()
            .set_default("token_decimals", TOKEN_DECIMALS).unwrap()
            .set_default("initial_supply", INITIAL_SUPPLY).unwrap()
            .set_default("token_description", TOKEN_DESCRIPTION).unwrap()
            .set_default("token_image_uri", TOKEN_IMAGE_URI).unwrap()
            .set_default("mint_authority_seed", MINT_AUTHORITY_SEED).unwrap()

            .set_default("token_website", TOKEN_WEBSITE).unwrap()
            .set_default("token_twitter", TOKEN_TWITTER).unwrap()
            .set_default("token_telegram", TOKEN_TELEGRAM).unwrap()
            .set_default("token_discord", TOKEN_DISCORD).unwrap()

            .build()
            .expect("Safe token defaults should always build successfully")
    }

    pub fn get_stats(&self) -> TokenConfigStats {
        TokenConfigStats {
            environment: self.environment.clone(),
            load_duration: self.load_start_time.elapsed(),
            timestamp: std::time::SystemTime::now(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct TokenConfigStats {
    pub environment: String,
    pub load_duration: std::time::Duration,
    pub timestamp: std::time::SystemTime,
}

impl Default for TokenConfigLoader {
    fn default() -> Self {
        Self::new()
    }
}
