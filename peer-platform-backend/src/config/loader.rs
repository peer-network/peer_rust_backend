use config::{Config, Environment, File, FileFormat};
use crate::utils::{constants::*, errors::*};
use std::path::Path;
use tracing::{info, warn, debug, error, instrument};
use std::time::Instant;


///   Flow 
/// -> Main ( Server Runs ) -> PlatformConfig::load Runs -> ConfigLoader::new(); (new loader Configuration)
/// -> PlatformConfig::load Runs -> loader.build() (Builds Config from Multiple Source)
/// -> loader.build() -> calls  load_environment_variables()?; -> calls get_env_file_for_environment(); 
/// -> load_environment_variables()? -> calls load_single_env_file() -> loads
/// -> loader.build() -> calls build_config_sources() -> adds all sources into builder & Returns config
/// -> Result<Config> - Built configuration ready for deserialization
  
#[derive(Debug)]
pub struct ConfigLoader {
    environment: String,
    load_start_time: Instant,
}

impl ConfigLoader {

    /// 1. new() 
    /// 2. build() are the main  functions 


    /// Initialize a new configuration loader 
    pub fn new() -> Self {
        let environment = Self::detect_environment();
        info!(" ConfigLoader initialized for environment: {}", environment);
        
        Self {
            environment,
            load_start_time: Instant::now(),
        }
    }
    
    ///  loader.build()?; 
    #[instrument(skip(self), fields(env = %self.environment))]
    pub fn build(&self) -> Result<Config> {
        info!(" Loading configuration files");
        let start_time = Instant::now();

        // 1: Load environment variables 
        self.load_environment_variables()?;

        // 2: Build configuration from all sources
        let config = self.build_config_sources()?;

        let duration = start_time.elapsed();
        info!(" Configuration files loaded in {:?}", duration);
        
        Ok(config)
    }

    /// Detect the current environment from RUST_ENV variable (Session)
    fn detect_environment() -> String {
        match std::env::var("RUST_ENV") {
            Ok(env) => {
                let env: String = env.to_lowercase();
                match env.as_str() {
                    "production" | "prod" => PRODUCTION_ENV.to_string(),
                    "development" | "dev" => DEVELOPMENT_ENV.to_string(),
                    "local" => LOCAL_ENV.to_string(),
                    _ => {
                        warn!(" Unknown RUST_ENV '{}', defaulting to '{}'", env, DEFAULT_ENVIRONMENT);
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

    /// Load environment variables from .env files
    #[instrument(skip(self))]
    fn load_environment_variables(&self) -> Result<()> {
        debug!(" Loading environment variables for: {}", self.environment);

        let env_file = self.get_env_file_for_environment();
        
        match self.load_single_env_file(&env_file) {
            Ok(true) => {
                info!("  Loaded: {}", env_file);
                info!("  Environment file loaded successfully");
            },
            Ok(false) => {
                return Err(PlatformError::Config(ConfigurationError::FileNotFound { 
                    file_path: env_file 
                }));
            },
            Err(e) => {
                error!(" Failed to load env file: {}", env_file);
                return Err(e);
            }
        }

        Ok(())
    }

    /// Get the specific environment file for current environment
    fn get_env_file_for_environment(&self) -> String {
        match self.environment.as_str() {
            "production" => ".env.prod".to_string(),
            "development" => ".env.dev".to_string(),
            "local" => ".env.local".to_string(),
            _ => ".env.local".to_string(),  // Default to local
        }
    }

    /// Load a single environment file
    #[instrument(skip(self))]
    fn load_single_env_file(&self, file_path: &str) -> Result<bool> {
        let path = Path::new(file_path);
        
        if !path.exists() {
            return Ok(false);
        }

        // Load the environment file
        dotenvy::from_path(path)
            .map_err(|e| PlatformError::Config(ConfigurationError::EnvFileError { 
                reason: format!("Failed to parse {}: {}", file_path, e) 
            }))?;

        debug!(" Environment file loaded: {}", file_path);
        Ok(true)
    }

    /// Build configuration from multiple sources
    #[instrument(skip(self))]
    fn build_config_sources(&self) -> Result<Config> {
        debug!(" Building configuration sources");

        let mut builder = Config::builder();

        // 1. Safe constants 
        builder = builder.add_source(self.build_safe_defaults());

        // 2. TOML configuration files
        builder = self.add_toml_sources(builder)?;

        // 3. Environment variables
        builder = builder.add_source(
            Environment::default()
                .separator("__")
                .try_parsing(true)
        );

        // Build final configuration
        let config = builder.build()
            .map_err(|e| PlatformError::Config(ConfigurationError::ConfigLoadError(e)))?;

        debug!(" Configuration sources built successfully");
        Ok(config)
    }

    /// Add TOML configuration sources
    fn add_toml_sources(&self, mut builder: config::ConfigBuilder<config::builder::DefaultState>) -> Result<config::ConfigBuilder<config::builder::DefaultState>> {
        let toml_file = self.get_toml_file_for_environment();
        
        if Path::new(&toml_file).exists() {
            info!(" Loading TOML config: {}", toml_file);
            builder = builder.add_source(
                File::with_name(&toml_file)
                    .format(FileFormat::Toml)
                    .required(false)
            );
        } else {
            debug!(" TOML file not found: {}", toml_file);
        }

        Ok(builder)
    }

    /// Get the specific TOML file for current environment
    fn get_toml_file_for_environment(&self) -> String {
        match self.environment.as_str() {
            "production" => "config/production.toml".to_string(),
            "development" => "config/development.toml".to_string(),
            "local" => "config/local.toml".to_string(),
            _ => "config/local.toml".to_string(),  // Default to local
        }
    }

    /// Build safe default configuration from constants
    fn build_safe_defaults(&self) -> Config {
        debug!(" Building safe defaults from constants");
        
        Config::builder()
            // Server configuration
            .set_default("server.host", SERVER_HOST).unwrap()
            .set_default("server.port", SERVER_PORT).unwrap()
            .set_default("server.workers", DEFAULT_WORKERS as i64).unwrap()
            
            // Solana configuration  
            .set_default("solana.cluster", DEFAULT_CLUSTER).unwrap()
            .set_default("solana.commitment", DEFAULT_COMMITMENT).unwrap()
            .set_default("solana.timeout", RPC_TIMEOUT_SECONDS).unwrap()
            .set_default("solana.max_retries", MAX_RETRIES).unwrap()
            
            // Security configuration
            .set_default("security.rate_limit_rpm", RATE_LIMIT_RPM).unwrap()
            
            // Cashout configuration
            .set_default("cashout.min_amount", MIN_CASHOUT_AMOUNT).unwrap()
            .set_default("cashout.max_amount", MAX_CASHOUT_AMOUNT).unwrap()
            
            // Logging configuration
            .set_default("logging.level", DEFAULT_LOG_LEVEL).unwrap()
            .set_default("logging.file_path", DEFAULT_LOG_FILE_PATH).unwrap()
            .set_default("logging.format", DEFAULT_LOG_FORMAT).unwrap()
            .set_default("logging.enable_tracing", DEFAULT_LOG_TRACING).unwrap()
            .set_default("logging.rotation", DEFAULT_LOG_ROTATION).unwrap()
            
            .build()
            .expect("Safe defaults should always build successfully")
    }

    /// Get configuration loading statistics
    pub fn get_stats(&self) -> ConfigStats {
        ConfigStats {
            environment: self.environment.clone(),
            load_duration: self.load_start_time.elapsed(),
            timestamp: std::time::SystemTime::now(),
        }
    }
}

/// Configuration loading statistics
#[derive(Debug, Clone)]
pub struct ConfigStats {
    pub environment: String,
    pub load_duration: std::time::Duration,
    pub timestamp: std::time::SystemTime,
}

impl Default for ConfigLoader {
    fn default() -> Self {
        Self::new()
    }
}
