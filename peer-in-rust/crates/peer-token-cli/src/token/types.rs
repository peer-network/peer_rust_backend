
use serde::{Deserialize, Serialize};
use solana_sdk::pubkey::Pubkey;
use peer_common::utils::errors::{Result, PlatformError};


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenCreationRequest {
    pub token_name: String,
    pub token_symbol: String,
    pub token_decimals: u8,
    pub initial_supply: u64,
    pub admin_pubkey: String,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenResult {
    pub mint_address: String,
    pub mint_authority: String,
    pub admin_token_account: String,
    pub initial_supply: u64,
    pub creation_signature: String,
    pub minting_signature: String,
    pub mint_lock_status: bool,
    pub creation_timestamp: i64,
    pub cluster: String,
}



#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TokenStatus {
    NotCreated,
    Created,
    MintLocked,
    Error(String),
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenMetadata {
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
    pub total_supply: u64,
    pub created_at: i64,
    pub mint_authority: Option<String>,
    pub freeze_authority: Option<String>,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenAccountInfo {
    pub address: String,
    pub owner: String,
    pub mint: String,
    pub balance: u64,
    pub is_frozen: bool,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenCreationStats {
    pub total_cost_sol: f64,
    pub mint_creation_cost: f64,
    pub account_creation_cost: f64,
    pub minting_cost: f64,
    pub total_transactions: u32,
    pub creation_duration_ms: u64,
}

impl TokenResult {

    pub fn get_explorer_url(&self) -> String {
        let cluster_param = if self.cluster == "devnet" { "?cluster=devnet" } else { "" };
        format!("https://explorer.solana.com/address/{}{}", self.mint_address, cluster_param)
    }


    pub fn is_successful(&self) -> bool {
        !self.mint_address.is_empty() && !self.creation_signature.is_empty()
    }


    pub fn get_mint_pubkey(&self) -> Result<Pubkey> {
        self.mint_address.parse()
            .map_err(|e| PlatformError::InvalidInput(format!("Invalid mint address: {}", e)))
    }


    pub fn get_admin_token_account_pubkey(&self) -> Result<Pubkey> {
        self.admin_token_account.parse()
            .map_err(|e| PlatformError::InvalidInput(format!("Invalid admin token account: {}", e)))
    }
}

impl TokenStatus {

    pub fn is_locked(&self) -> bool {
        matches!(self, TokenStatus::MintLocked)
    }


    pub fn can_create(&self) -> bool {
        matches!(self, TokenStatus::NotCreated)
    }


    pub fn is_error(&self) -> bool {
        matches!(self, TokenStatus::Error(_))
    }
}

impl Default for TokenStatus {
    fn default() -> Self {
        TokenStatus::NotCreated
    }
}
