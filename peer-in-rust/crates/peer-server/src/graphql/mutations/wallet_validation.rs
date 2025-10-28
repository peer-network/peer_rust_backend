
use async_graphql::{Object, Result, SimpleObject, InputObject, Context};
use serde::{Deserialize, Serialize};
use tracing::{info, debug, warn, error};
use solana_sdk::pubkey::Pubkey;
// use solana_client::{nonblocking::rpc_client, rpc_client::RpcClient};
use solana_client::rpc_client::RpcClient;
use solana_sdk::commitment_config::CommitmentConfig;
use std::str::FromStr;
use peer_common::config::PlatformConfig;


#[derive(InputObject, Debug)]
pub struct ValidateWalletInput {
    pub pubkey: String,
}

#[derive(Debug, Serialize, Deserialize, SimpleObject)]
pub struct WalletValidationResult {
    pub is_valid: bool,
    pub message: String,
    pub formatted_pubkey: Option<String>,
    pub validation_details: ValidationDetails,
    pub on_chain_details: Option<OnChainDetails>,
}

#[derive(Debug, Serialize, Deserialize, SimpleObject)]
pub struct ValidationDetails {
    pub length_valid: bool,
    pub base58_valid: bool,
    pub charset_valid: bool,
    pub not_system_account: bool,
    pub input_length: i32,
}

#[derive(Debug, Serialize, Deserialize, SimpleObject)]
pub struct OnChainDetails {
    pub exists_on_chain: bool,
    pub balance_lamports: Option<i64>,
    pub balance_sol: Option<f64>,
    pub is_executable: Option<bool>,
    pub owner: Option<String>,
    pub data_length: Option<i32>,
    pub rpc_endpoint: String,
}

/// Wallet validation function that can be reused by other mutations
pub async fn validate_wallet_internal(pubkey_str: &str , config: &PlatformConfig) -> Result<WalletValidationResult> {
    
    let pubkey_str = pubkey_str.trim();
    
    let length_valid = pubkey_str.len() == 44;
    
    let charset_valid = is_valid_base58_charset(pubkey_str);
    
    let (base58_valid, parsed_pubkey) = match Pubkey::from_str(pubkey_str) {
        Ok(pubkey) => {
            debug!("Successfully parsed pubkey: {}", pubkey);
            (true, Some(pubkey))
        }
        Err(e) => {
            debug!("Failed to parse pubkey: {}", e);
            (false, None)
        }
    };
    
    let not_system_account = if let Some(pubkey) = parsed_pubkey {
        let is_system = pubkey == Pubkey::default() || 
                       pubkey.to_string() == "11111111111111111111111111111112";
        !is_system
    } else {
        false
    };
    
    // Combine validation result
    let basic_valid = length_valid && charset_valid && base58_valid && not_system_account;
    
    let validation_details = ValidationDetails {
        length_valid,
        base58_valid,
        charset_valid,
        not_system_account,
        input_length: pubkey_str.len() as i32,
    };
    
    // Only checks when basic validation passes -> Onchain verification
    let on_chain_details = if basic_valid && parsed_pubkey.is_some() {
        let pubkey = parsed_pubkey.unwrap();
        match check_wallet_on_chain(&pubkey , &config.solana.rpc_url).await {
            Ok(details) => Some(details),
            Err(e) => {
                error!("Failed to check wallet on-chain: {:?}", e);
                Some(OnChainDetails {
                    exists_on_chain: false,
                    balance_lamports: None,
                    balance_sol: None,
                    is_executable: None,
                    owner: None,
                    data_length: None,
                    rpc_endpoint: "Error connecting to RPC".to_string(),
                })
            }
        }
    } else {
        Some(OnChainDetails {
            exists_on_chain: false,
            balance_lamports: None,
            balance_sol: None,
            is_executable: None,
            owner: None,
            data_length: None,
            rpc_endpoint: "Skipped due to invalid address".to_string(),
        })
    };
    
    // Final validation result 
    let is_valid = basic_valid && on_chain_details.as_ref().map_or(false, |details| details.exists_on_chain);
    
    let (message, formatted_pubkey) = if !basic_valid {
        let mut issues = Vec::new();
        
        if !length_valid {
            issues.push(format!("Invalid length: {} (expected: 44)", pubkey_str.len()));
        }
        if !charset_valid {
            issues.push("Contains invalid characters (not Base58)".to_string());
        }
        if !base58_valid {
            issues.push("Invalid Base58 encoding".to_string());
        }
        if !not_system_account && base58_valid {
            issues.push("System account address (not allowed)".to_string());
        }
        
        (
            format!("Invalid wallet address: {}", issues.join(", ")),
            None
        )
    } else if !on_chain_details.as_ref().map_or(false, |d| d.exists_on_chain) {
        (
            "Valid address format but wallet does not exist on Solana blockchain".to_string(),
            Some(pubkey_str.to_string())
        )
    } else {
        let balance_info = if let Some(ref details) = on_chain_details {
            if let Some(balance_sol) = details.balance_sol {
                format!(" (Balance: {} SOL)", balance_sol)
            } else {
                String::new()
            }
        } else {
            String::new()
        };
        
        (
            format!("Valid Solana wallet address{}", balance_info),
            Some(pubkey_str.to_string())
        )
    };
    
    let result = WalletValidationResult {
        is_valid,
        message: message.clone(),
        formatted_pubkey,
        validation_details,
        on_chain_details,
    };
    
    if is_valid {
        info!("Wallet validation passed: {}", pubkey_str);
    } else {
        warn!("Wallet validation failed: {} - {}", pubkey_str, message);
    }
    
    Ok(result)
}




/// Wallet validation mutations
#[derive(Default)]
pub struct WalletValidationMutations;

#[Object]
impl WalletValidationMutations {
   
    async fn validate_wallet(&self, ctx: &Context<'_>, input: ValidateWalletInput) -> Result<WalletValidationResult> {
        info!("Wallet validation mutation requested for: {}", input.pubkey);
        
        let config = ctx.data::<PlatformConfig>()
            .map_err(|_| async_graphql::Error::new("Platform configuration not available"))?;
        
        info!("Using RPC URL from config: {}", config.solana.rpc_url);
        // Call validation function
        validate_wallet_internal(&input.pubkey, config).await
    }
}



/// Check wallet existence on Solana blockchain
async fn check_wallet_on_chain(pubkey: &Pubkey, rpc_url: &str) -> Result<OnChainDetails> {

    debug!("Checking wallet on-chain via RPC: {}", rpc_url);
    
    let client = RpcClient::new_with_commitment(rpc_url, CommitmentConfig::confirmed());
    
    match client.get_account_with_commitment(pubkey, CommitmentConfig::confirmed()) {
        Ok(response) => {
            if let Some(account) = response.value {
                let balance_lamports = account.lamports as i64;
                let balance_sol = account.lamports as f64 / 1_000_000_000.0; // Convert lamports to SOL
                
                debug!("Wallet exists on-chain with balance: {} SOL", balance_sol);
                
                Ok(OnChainDetails {
                    exists_on_chain: true,
                    balance_lamports: Some(balance_lamports),
                    balance_sol: Some(balance_sol),
                    is_executable: Some(account.executable),
                    owner: Some(account.owner.to_string()),
                    data_length: Some(account.data.len() as i32),
                    rpc_endpoint: rpc_url.to_string(),
                })
            } else {
                debug!("Wallet does not exist on-chain");
                
                Ok(OnChainDetails {
                    exists_on_chain: false,
                    balance_lamports: Some(0),
                    balance_sol: Some(0.0),
                    is_executable: None,
                    owner: None,
                    data_length: None,
                    rpc_endpoint: rpc_url.to_string(),
                })
            }
        }
        Err(e) => {
            error!("Failed to query account from RPC: {}", e);
            Err(async_graphql::Error::new(format!(
                "Failed to check wallet on blockchain: {}", e
            )))
        }
    }
}

/// Check if string contains only valid Base58 characters
fn is_valid_base58_charset(input: &str) -> bool {
    const BASE58_ALPHABET: &str = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    
    input.chars().all(|c| BASE58_ALPHABET.contains(c))
}