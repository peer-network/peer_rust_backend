


pub const SERVER_HOST: &str = "127.0.0.1";
pub const SERVER_PORT: u16 = 4000;
pub const DEFAULT_WORKERS: usize = 4;

pub const DEFAULT_COMMITMENT: &str = "confirmed"; 
pub const RPC_TIMEOUT_SECONDS: u64 = 30;
pub const MAX_RETRIES: u32 = 3;
pub const DEFAULT_CLUSTER: &str = "devnet";

pub const RATE_LIMIT_RPM: u32 = 1000;
pub const MIN_API_KEY_LENGTH: usize = 20;
pub const MAX_API_KEY_LENGTH: usize = 256;

pub const MIN_CASHOUT_AMOUNT: u64 = 1000;       // 0.001 PEER (with 6 decimals)
pub const MAX_CASHOUT_AMOUNT: u64 = 1_000_000;  // 1000 PEER (with 6 decimals)
pub const CASHOUT_FEE_BASIS_POINTS: u16 = 100;  // 1% fee

pub const DEFAULT_LOG_LEVEL: &str = "info";
pub const DEFAULT_LOG_FILE_PATH: &str = "./logs";
pub const DEFAULT_LOG_FORMAT: &str = "json";
pub const DEFAULT_LOG_ROTATION: &str = "daily";
pub const DEFAULT_LOG_TRACING: bool = true;

pub const MIN_PUBKEY_LENGTH: usize = 32;
pub const MAX_PUBKEY_LENGTH: usize = 44;
pub const SOLANA_PUBKEY_LENGTH: usize = 44;

pub const APP_NAME: &str = "peer-platform-backend";
pub const APP_VERSION: &str = env!("CARGO_PKG_VERSION");

pub const TOKEN_NAME: &str = "PEER Social Token";
pub const TOKEN_SYMBOL: &str = "PEER";
pub const TOKEN_DECIMALS: u8 = 9;
pub const INITIAL_SUPPLY: u64 = 19_500_000;
pub const TOKEN_DESCRIPTION: &str = "PEER is the social token powering the peer-to-peer revolution, enabling direct value exchange in social ecosystems.";
pub const TOKEN_IMAGE_URI: &str = "https://peer.inc/assets/peer-token-logo.png";
pub const MINT_AUTHORITY_SEED: &str = "peer_mint_authority";


pub const TOKEN_WEBSITE: &str = "https://dev.peer.inc";
pub const TOKEN_TWITTER: &str = "https://twitter.com/peer_inc";
pub const TOKEN_TELEGRAM: &str = "https://t.me/peer_dev";
pub const TOKEN_DISCORD: &str = "https://discord.gg/peer-dev";

pub const DEFAULT_ENVIRONMENT: &str = "development";
pub const PRODUCTION_ENV: &str = "production";
pub const DEVELOPMENT_ENV: &str = "development";
pub const LOCAL_ENV: &str = "local";




 