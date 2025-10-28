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
        // self.load_environment_variables()?;

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


    /// Build configuration from multiple sources
    #[instrument(skip(self))]
    fn build_config_sources(&self) -> Result<Config> {
        debug!(" Building configuration sources");

        let mut builder = Config::builder();

        // 1. Safe constants 
        // builder = builder.add_source(self.build_safe_defaults());

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
            .map_err(|e| PlatformError::Config(ConfigurationError::ConfigLoadError(e.to_string())))?;

        debug!(" Configuration sources built successfully");
        Ok(config)
    }

    /// Add TOML configuration sources
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

    /// Get the specific TOML file for current environment
    fn get_toml_file_for_environment(&self) -> String {
        match self.environment.as_str() {
            "production" => "config/production.toml".to_string(),
            "development" => "config/development.toml".to_string(),
            "local" => "config/local.toml".to_string(),
            _ => "config/local.toml".to_string(),  // Default to local
        }
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
