
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ConfigurationError {
    #[error(" CRITICAL: {field} not set. Set environment variable: {env_var}")]
    RequiredFieldMissing { field: String, env_var: String },
    
    #[error(" SECURITY: {field} contains insecure default value. Must be set via: {env_var}")]
    InsecureDefault { field: String, env_var: String },
    
    #[error(" FILE ERROR: {file_path} not found. Check path and permissions.")]
    FileNotFound { file_path: String },
    
    #[error(" VALIDATION: {field} is invalid: {reason}")]
    ValidationError { field: String, reason: String },
    
    #[error(" ENV ERROR: Failed to load .env file: {reason}")]
    EnvFileError { reason: String },
    
    #[error(" CONFIGURATION ERROR: {0}")]
    ConfigLoadError(String),
    
    #[error(" IO ERROR: {0}")]
    IoError(#[from] std::io::Error),
}

#[derive(Error, Debug)]
pub enum PlatformError {
    #[error("Configuration error: {0}")]
    Config(#[from] ConfigurationError),
    
    #[error("Token error: {0}")]
    Token(#[from] TokenError),
    
    #[error("Solana validation error: {0}")]
    SolanaValidation(String),
    
    #[error("Invalid input: {0}")]
    InvalidInput(String),
    
    #[error("Internal error: {0}")]
    Internal(#[from] anyhow::Error),
}

#[derive(Error, Debug)]
pub enum TokenError {
    #[error("Token already exists and mint is locked")]
    TokenAlreadyExists,
    
    #[error("Keypair not found at path: {0}")]
    KeypairNotFound(String),
    
    #[error("Failed to read keypair: {0}")]
    KeypairReadError(String),
    
    #[error("Failed to parse keypair: {0}")]
    KeypairParseError(String),
    
    #[error("Invalid keypair length: {0} (expected 64 bytes)")]
    InvalidKeypairLength(usize),
    
    #[error("Failed to create keypair: {0}")]
    KeypairCreationError(String),
    
    #[error("Invalid token name: {0}")]
    InvalidTokenName(String),
    
    #[error("Invalid token symbol: {0}")]
    InvalidTokenSymbol(String),
    
    #[error("Invalid token decimals (must be 0-9)")]
    InvalidDecimals,
    
    #[error("Invalid initial supply (must be > 0)")]
    InvalidSupply,
    
    #[error("Token supply overflow")]
    SupplyOverflow,
    
    #[error("Invalid mint authority seed: {0}")]
    InvalidSeed(String),
    
    #[error("Insufficient balance for token creation")]
    InsufficientBalance,
    
    #[error("Transaction failed: {0}")]
    TransactionFailed(String),
    
    #[error("RPC client error: {0}")]
    RpcError(String),
    
    #[error("Token creation timeout")]
    CreationTimeout,
}

pub type Result<T> = std::result::Result<T, PlatformError>;

pub type ConfigError = ConfigurationError;



    