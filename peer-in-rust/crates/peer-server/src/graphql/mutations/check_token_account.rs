

use async_graphql::{Context, Object, Result, SimpleObject, InputObject};
use serde::{Deserialize, Serialize};
use tracing::{info, debug, warn, error};
use solana_sdk::{pubkey::Pubkey, commitment_config::CommitmentConfig};
use solana_client::rpc_client::RpcClient;
use spl_token_2022::ID as TOKEN_2022_PROGRAM_ID;
use spl_associated_token_account;
use std::str::FromStr;

use peer_common::config::PlatformConfig;
use crate::graphql::mutations::wallet_validation;

#[derive(InputObject, Debug)]
pub struct CheckTokenAccountInput {
    pub wallet_pubkey: String,
}

#[derive(Debug, Serialize, Deserialize, SimpleObject)]
pub struct TokenAccountResult {
    pub wallet_valid: bool,
    pub token_account_exists: bool,
    pub message: String,
    pub wallet_pubkey: Option<String>,
    pub token_account_address: Option<String>,
    pub mint_address: String,
    pub account_details: Option<TokenAccountDetails>,
}

#[derive(Debug, Serialize, Deserialize, SimpleObject)]
pub struct TokenAccountDetails {
    pub balance: String,
    pub balance_ui: f64,
    pub owner: String,
    pub mint: String,
    pub is_initialized: bool,
    pub is_frozen: bool,
    pub rpc_endpoint: String,
}

/// Token account checking mutations
#[derive(Default)]
pub struct CheckTokenAccountMutations;

#[Object]
impl CheckTokenAccountMutations {
    async fn check_token_account(&self, ctx: &Context<'_>, input: CheckTokenAccountInput) -> Result<TokenAccountResult> {
        info!("Token account check mutation requested for: {}", input.wallet_pubkey);
        
        let config = ctx.data::<PlatformConfig>()
            .map_err(|_| async_graphql::Error::new("Platform configuration not available"))?;

        info!("Using RPC URL from config: {}", config.solana.rpc_url);
        
        let wallet_pubkey_str = input.wallet_pubkey.trim();
        
        // First validate wallet
        info!("Performing wallet validation first...");
        let validation_result = wallet_validation::validate_wallet_internal(wallet_pubkey_str, config).await?;

        if !validation_result.is_valid {
            warn!("Wallet validation failed, cannot check token account: {}", validation_result.message);
            let mint_address = config.solana.peer_mint_address
                .clone()
                .unwrap_or_else(|| "Not configured".to_string());
            return Ok(TokenAccountResult {
                wallet_valid: false,
                token_account_exists: false,
                message: format!("Wallet validation failed: {}", validation_result.message),
                wallet_pubkey: None,
                token_account_address: None,
                mint_address,
                account_details: None,
            });
        }
        
        // Then call internal function for token account check
        check_token_account_internal(&input.wallet_pubkey, config).await
    }
}

/// Token account checking function that can be reused by other mutations
pub async fn check_token_account_internal(
    wallet_pubkey_str: &str,
    config: &PlatformConfig
) -> Result<TokenAccountResult> {
    info!("Internal token account check for wallet: {}", wallet_pubkey_str);
    
    let wallet_pubkey_str = wallet_pubkey_str.trim();
    
    let mint_address = config.solana.peer_mint_address
        .clone()
        .ok_or_else(|| async_graphql::Error::new("PEER mint address not configured"))?;
    info!("Using PEER mint address: {}", mint_address);

    // Parse wallet pubkey (assume already validated)
    let wallet_pubkey = match Pubkey::from_str(wallet_pubkey_str) {
        Ok(pubkey) => pubkey,
        Err(e) => {
            warn!("Invalid wallet pubkey format: {}", e);
            return Ok(TokenAccountResult {
                wallet_valid: false,
                token_account_exists: false,
                message: format!("Invalid wallet address format: {}", e),
                wallet_pubkey: None,
                token_account_address: None,
                mint_address,
                account_details: None,
            });
        }
    };
    
    // Parse mint address
    let mint_pubkey = match Pubkey::from_str(&mint_address) {
        Ok(pubkey) => pubkey,
        Err(e) => {
            error!("Invalid PEER mint address in config: {}", e);
            return Err(async_graphql::Error::new(format!(
                "Configuration error: Invalid PEER mint address: {}", e
            )));
        }
    };
    
    // Calculate Associated Token Account (ATA) address using SPL Token 2022
    let token_account_address = spl_associated_token_account::get_associated_token_address_with_program_id(
        &wallet_pubkey, 
        &mint_pubkey, 
        &TOKEN_2022_PROGRAM_ID
    );
    info!("Calculated ATA address: {}", token_account_address);
    
    // Check if token account exists on-chain 
    let account_details = check_token_account_on_chain(&token_account_address, &mint_address, config).await?;
    
    let (token_account_exists, message) = if account_details.is_some() {
        (
            true,
            format!("Token account exists for wallet with balance: {} PEER", 
                account_details.as_ref().unwrap().balance_ui
            )
        )
    } else {
        (
            false,
            "No PEER token account found for this wallet".to_string()
        )
    };
    
    let result = TokenAccountResult {
        wallet_valid: true,
        token_account_exists,
        message: message.clone(),
        wallet_pubkey: Some(wallet_pubkey_str.to_string()),
        token_account_address: Some(token_account_address.to_string()),
        mint_address,
        account_details,
    };
    
    if token_account_exists {
        info!("Token account check passed: {}", wallet_pubkey_str);
    } else {
        info!("Token account not found: {}", wallet_pubkey_str);
    }
    
    debug!("Sending token account result: {:?}", result);
    Ok(result)
}

/// Check token account existence on Solana blockchain
async fn check_token_account_on_chain(
    token_account_address: &Pubkey, 
    _mint_address: &str,
    config: &PlatformConfig
) -> Result<Option<TokenAccountDetails>> {
    let rpc_url = &config.solana.rpc_url;
    debug!("Checking token account on-chain via RPC: {}", rpc_url);
    
    let client = RpcClient::new_with_commitment(rpc_url.clone(), CommitmentConfig::confirmed());
    
    match client.get_token_account_with_commitment(token_account_address, CommitmentConfig::confirmed()) {
        Ok(response) => {
            if let Some(token_account) = response.value {
                // Parse token account data directly from UiTokenAccount
                let balance = token_account.token_amount.amount.clone();
                let balance_ui = token_account.token_amount.ui_amount.unwrap_or(0.0);
                let owner = token_account.owner.clone();
                let mint = token_account.mint.clone();
                
                // Handle the state directly - it's an enum, not an Option
                let state_str = format!("{:?}", token_account.state).to_lowercase();
                let is_initialized = state_str == "initialized";
                let is_frozen = state_str == "frozen";
                
                debug!("Token account exists with balance: {} PEER", balance_ui);
                
                Ok(Some(TokenAccountDetails {
                    balance,
                    balance_ui,
                    owner,
                    mint,
                    is_initialized,
                    is_frozen,
                    rpc_endpoint: rpc_url.clone(),
                }))
            } else {
                debug!("Token account does not exist on-chain");
                Ok(None)
            }
        }
        Err(e) => {
            warn!("Failed to query token account from RPC: {}", e);
            Ok(None)
        }
    }
}