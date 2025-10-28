
use async_graphql::{Context, Object, Result, SimpleObject, InputObject, Enum};
use serde::{Deserialize, Serialize};
use tracing::{info, warn, error};
use solana_sdk::{
    commitment_config::CommitmentConfig,
    signature::Signature,
    signer::{keypair::Keypair, Signer},
    transaction::Transaction,
    pubkey::Pubkey,
};
use solana_client::rpc_client::RpcClient;
use spl_token_2022::{
    ID as TOKEN_2022_PROGRAM_ID,
    instruction::transfer_checked,
};
use spl_associated_token_account;
use std::str::FromStr;
use std::fs;
use uuid::Uuid;
use base64::{Engine as _, engine::general_purpose};
use bincode;
use serde_json;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use peer_common::config::PlatformConfig;
use crate::graphql::mutations::{wallet_validation, check_token_account};

// Temporary in-memory session storage 
lazy_static::lazy_static! {
    static ref SESSION_STORE: Arc<Mutex<HashMap<String, TransformSession>>> = 
        Arc::new(Mutex::new(HashMap::new()));
}

#[derive(Debug, Clone, Serialize, Deserialize, Enum, Copy, PartialEq, Eq)]
pub enum TransformState {
    Validating,
    WaitingConfirmation,
    WaitingUserSignature,
    WaitingGasPayment,
    ProcessingTransfer,
    Completed,
    Failed,
    Cancelled,
}

#[derive(InputObject, Debug)]
pub struct InitiateTransformInput {
    pub wallet_pubkey: String,
    pub amount: f64,
}

#[derive(InputObject, Debug)]
pub struct ConfirmTransformInput {
    pub session_id: String,
    pub confirmed: bool,
}

#[derive(InputObject, Debug)]
pub struct CompleteTransformInput {
    pub session_id: String,
    pub signed_transaction: String,
}

#[derive(Debug, Serialize, Deserialize, SimpleObject, Clone)]
pub struct TransformSession {
    pub session_id: String,
    pub state: TransformState,
    pub wallet_pubkey: String,
    pub token_account_address: String,
    pub amount: f64,
    pub amount_raw: u64,
    pub estimated_gas_fee: f64,
    pub company_wallet: String,
    pub prepared_transaction: Option<String>,
    pub gas_payment_signature: Option<String>,
    pub transfer_signature: Option<String>,
    pub error_message: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, SimpleObject)]
pub struct TransformResult {
    pub success: bool,
    pub message: String,
    pub session: Option<TransformSession>,
    pub next_action: Option<String>,
    pub redirect_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, SimpleObject)]
pub struct GasPaymentInfo {
    pub gas_fee_sol: f64,
    pub gas_fee_lamports: u64,
    pub gas_wallet_address: String,
    pub payment_instructions: String,
    pub qr_code_data: String,
}

/// Transform mutations
#[derive(Default)]
pub struct TransformMutations;

#[Object]
impl TransformMutations {
    /// Step 1: Initiate transform - validates wallet and token account
    async fn initiate_transform(
        &self, 
        ctx: &Context<'_>, 
        input: InitiateTransformInput
    ) -> Result<TransformResult> {
        info!("Initiating transform for wallet: {} amount: {}", input.wallet_pubkey, input.amount);
        
        let config = ctx.data::<PlatformConfig>()
            .map_err(|_| async_graphql::Error::new("Platform configuration not available"))?;
        
        // Validate input
        if input.amount <= 0.0 {
            return Ok(TransformResult {
                success: false,
                message: "Amount must be greater than 0".to_string(),
                session: None,
                next_action: None,
                redirect_url: None,
            });
        }
        
        let wallet_pubkey_str = input.wallet_pubkey.trim();
        
        // Step 1: Validate wallet
        info!("Step 1: Validating wallet address...");
        let validation_result = wallet_validation::validate_wallet_internal(wallet_pubkey_str, config).await?;
        
        if !validation_result.is_valid {
            warn!("Wallet validation failed: {}", validation_result.message);
            return Ok(TransformResult {
                success: false,
                message: format!("Wallet validation failed: {}", validation_result.message),
                session: None,
                next_action: Some("fix_wallet_address".to_string()),
                redirect_url: None,
            });
        }
        
        // Step 2: Check token account exists
        info!("Step 2: Checking token account...");
        let token_check_result = check_token_account::check_token_account_internal(wallet_pubkey_str, config).await?;
        
        if !token_check_result.token_account_exists {
            warn!("Token account not found for wallet: {}", wallet_pubkey_str);
            return Ok(TransformResult {
                success: false,
                message: token_check_result.message,
                session: None,
                next_action: Some("create_token_account".to_string()),
                redirect_url: None,
            });
        }
        
        // Get token account address from the result
        let token_account_address = token_check_result.token_account_address
            .ok_or_else(|| async_graphql::Error::new("Token account address not returned"))?;
        
        // Step 3: Create transform session
        let session_id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        
        let decimals = 9u32;
        let amount_raw = (input.amount * 10f64.powi(decimals as i32)) as u64;
        
        
        let estimated_gas_fee = estimate_gas_fee(config).await?;
        
        let session = TransformSession {
            session_id: session_id.clone(),
            state: TransformState::WaitingConfirmation,
            wallet_pubkey: wallet_pubkey_str.to_string(),
            token_account_address,
            amount: input.amount,
            amount_raw,
            estimated_gas_fee,
            company_wallet: config.solana.company_token_account.clone()
                .unwrap_or_else(|| "Company token account not configured".to_string()),
            prepared_transaction: None,
            gas_payment_signature: None,
            transfer_signature: None,
            error_message: None,
            created_at: now.clone(),
            updated_at: now,
        };
        
        // Store session in temporary in-memory storage 
        {
            let mut store = SESSION_STORE.lock().unwrap();
            store.insert(session_id.clone(), session.clone());
        }
        
        info!("Transform session created and stored: {}", session_id);
        
        Ok(TransformResult {
            success: true,
            message: format!(
                "Validation passed! Ready to transform {} PEER tokens. Gas fee: {} SOL", 
                input.amount, estimated_gas_fee
            ),
            session: Some(session),
            next_action: Some("confirm_transform".to_string()),
            redirect_url: None,
        })
    }
    
    /// Step 2: Confirm transform - user confirms the transaction details
    async fn confirm_transform(
        &self,
        ctx: &Context<'_>,
        input: ConfirmTransformInput
    ) -> Result<TransformResult> {
        info!("Confirming transform for session: {}", input.session_id);
        
        let config = ctx.data::<PlatformConfig>()
            .map_err(|_| async_graphql::Error::new("Platform configuration not available"))?;
        
        // Retrieve session from in-memory storage
        let session = {
            let store = SESSION_STORE.lock().unwrap();
            store.get(&input.session_id).cloned()
                .ok_or_else(|| async_graphql::Error::new(format!("Session not found: {}", input.session_id)))?
        };
        
        info!("Retrieved session for wallet: {}", session.wallet_pubkey);
        
        if !input.confirmed {
            info!("Transform cancelled by user: {}", input.session_id);
            
            // Update session state to Cancelled
            {
                let mut store = SESSION_STORE.lock().unwrap();
                if let Some(session) = store.get_mut(&input.session_id) {
                    session.state = TransformState::Cancelled;
                }
            }
            
            return Ok(TransformResult {
                success: false,
                message: "Transform cancelled by user".to_string(),
                session: None,
                next_action: None,
                redirect_url: None,
            });
        }
        
        //  Here company signs as authority & Prepare user transaction
        info!("Preparing transfer transaction...");
        
        // Use actual session data
        let user_wallet = &session.wallet_pubkey;
        let user_token_account = &session.token_account_address;
        let amount_raw = session.amount_raw;
        
        let partially_signed_tx = prepare_transfer_transaction(
            config, 
            user_wallet,
            user_token_account, 
            amount_raw
        ).await?;
        
        // Update session with prepared transaction
        {
            let mut store = SESSION_STORE.lock().unwrap();
            if let Some(session) = store.get_mut(&input.session_id) {
                session.state = TransformState::WaitingUserSignature;
                session.prepared_transaction = Some(partially_signed_tx.clone());
            }
        }
        
        info!("Transaction prepared for session: {}", input.session_id);
        
        Ok(TransformResult {
            success: true,
            message: format!(
                "Transaction prepared! Please sign in your wallet to complete the transfer and pay gas fees."
            ),
            session: None, 
            next_action: Some("sign_transaction".to_string()),
            redirect_url: Some(partially_signed_tx), 
        })
    }
    
    /// Step 3: Complete transform - submit user-signed transaction
    async fn complete_transform(
        &self,
        ctx: &Context<'_>,
        input: CompleteTransformInput
    ) -> Result<TransformResult> {
        info!("Completing transform for session: {} with signed transaction", input.session_id);
        
        let config = ctx.data::<PlatformConfig>()
            .map_err(|_| async_graphql::Error::new("Platform configuration not available"))?;
        
        // Retrieve session from in-memory storage
        let session = {
            let store = SESSION_STORE.lock().unwrap();
            store.get(&input.session_id).cloned()
                .ok_or_else(|| async_graphql::Error::new(format!("Session not found: {}", input.session_id)))?
        };
        
        info!("Completing transform for wallet: {}", session.wallet_pubkey);
        
        // Execute the user-signed transaction
        info!("Submitting user-signed transaction...");
        let transfer_signature = execute_signed_transaction(config, &input.signed_transaction).await?;
        
        // Update session to completed
        {
            let mut store = SESSION_STORE.lock().unwrap();
            if let Some(session) = store.get_mut(&input.session_id) {
                session.state = TransformState::Completed;
                session.transfer_signature = Some(transfer_signature.clone());
            }
        }
        
        info!("Transform completed successfully: {}", transfer_signature);
        
        Ok(TransformResult {
            success: true,
            message: format!(
                "Transform completed successfully! PEER tokens transferred. Transaction: {}", 
                transfer_signature
            ),
            session: None, 
            next_action: None,
            redirect_url: None,
        })
    }
    
    /// Get transform session status
    async fn get_transform_status(
        &self,
        _ctx: &Context<'_>,
        session_id: String
    ) -> Result<TransformResult> {
        info!("Getting transform status for session: {}", session_id);
        
        // Retrieve session from in-memory storage
        
        Ok(TransformResult {
            success: true,
            message: "Session status retrieved".to_string(),
            session: None, 
            next_action: None,
            redirect_url: None,
        })
    }
}

/// Helper function to estimate gas fees
async fn estimate_gas_fee(config: &PlatformConfig) -> Result<f64> {
    let rpc_url = &config.solana.rpc_url;
    let client = RpcClient::new_with_commitment(rpc_url.clone(), CommitmentConfig::confirmed());
    
    // Get recent blockhash for transaction estimation
    match client.get_latest_blockhash() {
        Ok(_blockhash) => {
            let estimated_lamports = 5000; 
            let estimated_sol = estimated_lamports as f64 / 1_000_000_000.0;
            Ok(estimated_sol.max(0.001)) 
        }
        Err(e) => {
            warn!("Failed to estimate gas fee: {}", e);
            Ok(0.001) 
        }
    }
}

/// Helper function to prepare transfer transaction
/// Company signs as authority, user will sign as payer
async fn prepare_transfer_transaction(
    config: &PlatformConfig,
    user_wallet: &str,
    user_token_account: &str,
    amount_raw: u64
) -> Result<String> {
    info!("Preparing transfer transaction - Company signing as authority...");
    
    // Step 1: Load company keypair (authority for token transfer)
    let keypair_data = fs::read_to_string(&config.solana.admin_keypair_path)
        .map_err(|e| async_graphql::Error::new(format!("Failed to read company keypair: {}", e)))?;
    
    let keypair_bytes: Vec<u8> = serde_json::from_str(&keypair_data)
        .map_err(|e| async_graphql::Error::new(format!("Failed to parse company keypair: {}", e)))?;
    
    let company_keypair = Keypair::try_from(keypair_bytes.as_slice())
        .map_err(|e| async_graphql::Error::new(format!("Failed to create keypair: {}", e)))?;
    
    info!("Company keypair loaded: {}", company_keypair.pubkey());
    
    // Step 2: Setup RPC client to query Chain
    let rpc_url = &config.solana.rpc_url;
    let client = RpcClient::new_with_commitment(rpc_url.clone(), CommitmentConfig::confirmed());
    
    // Step 3: Get recent blockhash
    let recent_blockhash = client.get_latest_blockhash()
        .map_err(|e| async_graphql::Error::new(format!("Failed to get blockhash: {}", e)))?;
    
    // Step 4: Parse addresses
    let user_wallet_pubkey = Pubkey::from_str(user_wallet)
        .map_err(|e| async_graphql::Error::new(format!("Invalid user wallet: {}", e)))?;
    
    let user_token_account_pubkey = Pubkey::from_str(user_token_account)
        .map_err(|e| async_graphql::Error::new(format!("Invalid user token account: {}", e)))?;
    
    let mint_address = config.solana.peer_mint_address.as_ref()
        .ok_or_else(|| async_graphql::Error::new("PEER mint address not configured"))?;
    
    let mint_pubkey = Pubkey::from_str(mint_address)
        .map_err(|e| async_graphql::Error::new(format!("Invalid mint address: {}", e)))?;
    
    // Step 5: Get company token account
    let company_token_account = spl_associated_token_account::get_associated_token_address_with_program_id(
        &company_keypair.pubkey(),
        &mint_pubkey,
        &TOKEN_2022_PROGRAM_ID
    );
    
    info!("Company token account: {}", company_token_account);
    info!("User token account: {}", user_token_account);
    info!("Transfer amount: {} raw units", amount_raw);
    
    // Step 6: Create transfer instruction
    let transfer_instruction = transfer_checked(
        &TOKEN_2022_PROGRAM_ID,          
        &company_token_account,           
        &mint_pubkey,                    
        &user_token_account_pubkey,      
        &company_keypair.pubkey(),        
        &[],                              
        amount_raw,                       
        9,                                
    ).map_err(|e| async_graphql::Error::new(format!("Failed to create transfer instruction: {}", e)))?;
    
    // Step 7: Create transaction with USER as payer (they pay gas)
    let mut transaction = Transaction::new_with_payer(
        &[transfer_instruction],
        Some(&user_wallet_pubkey)  
    );
    
    // Step 8: Set blockhash
    transaction.message.recent_blockhash = recent_blockhash;
    
    // Step 9: Company signs as authority (partial signature)
    transaction.partial_sign(&[&company_keypair], recent_blockhash);
    
    info!("Transaction partially signed by company (authority)");
    info!("User must sign as payer to complete transaction");
    
    // Step 10: Serialize transaction for user to sign (Solana's wire format for Phantom)
    let serialized_tx = bincode::serialize(&transaction)
        .map_err(|e| async_graphql::Error::new(format!("Failed to serialize transaction: {}", e)))?;
    let tx_base64 = general_purpose::STANDARD.encode(&serialized_tx);
    
    info!("Partially signed transaction ready for user");
    Ok(tx_base64)
}

/// Helper function to generate gas payment information
async fn generate_gas_payment_info(config: &PlatformConfig) -> Result<GasPaymentInfo> {
    let estimated_fee = estimate_gas_fee(config).await?;
    
    let gas_wallet = config.solana.gas_wallet_address
        .clone()
        .unwrap_or_else(|| "GasWalletNotConfigured".to_string());
    
    Ok(GasPaymentInfo {
        gas_fee_sol: estimated_fee,
        gas_fee_lamports: (estimated_fee * 1_000_000_000.0) as u64,
        gas_wallet_address: gas_wallet.clone(),
        payment_instructions: format!(
            "Send exactly {} SOL to {} for gas fees. This covers blockchain transaction costs.", 
            estimated_fee, gas_wallet
        ),
        qr_code_data: format!(
            "solana:{}?amount={}&label=PEER%20Transform%20Gas%20Fee",
            gas_wallet, estimated_fee
        ),
    })
}

/// Helper function to verify gas payment
async fn verify_gas_payment(
    signature: &str,
    config: &PlatformConfig
) -> Result<bool> {
    info!("Verifying gas payment signature: {}", signature);
    
    let rpc_url = &config.solana.rpc_url;
    let client = RpcClient::new_with_commitment(rpc_url.clone(), CommitmentConfig::confirmed());
    
    // Parse signature
    let sig = Signature::from_str(signature)
        .map_err(|e| async_graphql::Error::new(format!("Invalid signature format: {}", e)))?;
    
    // Check transaction status
    match client.get_signature_status(&sig) {
        Ok(Some(status)) => {
            if let Err(e) = status {
                warn!("Gas payment transaction failed: {:?}", e);
                Ok(false)
            } else {
                info!("Gas payment verified successfully");
                Ok(true)
            }
        }
        Ok(None) => {
            warn!("Gas payment transaction not found");
            Ok(false)
        }
        Err(e) => {
            error!("Failed to verify gas payment: {}", e);
            Ok(false)
        }
    }
}

/// Helper function to execute user-signed transaction
/// User has signed the transaction (as payer) and company already signed (as authority)
async fn execute_signed_transaction(
    config: &PlatformConfig,
    signed_transaction_base64: &str
) -> Result<String> {
    info!("Executing user-signed transaction...");
    
    // Step 1: Deserialize the user-signed transaction (using Solana's wire format)
    let tx_bytes = general_purpose::STANDARD.decode(signed_transaction_base64)
        .map_err(|e| async_graphql::Error::new(format!("Failed to decode transaction: {}", e)))?;
    
    let transaction = bincode::deserialize::<Transaction>(&tx_bytes)
        .map_err(|e| async_graphql::Error::new(format!("Failed to deserialize transaction: {}", e)))?;
    
    info!("User-signed transaction deserialized successfully");
    
    // Step 2: Verify transaction has both signatures (company + user)
    if transaction.signatures.len() < 2 {
        return Err(async_graphql::Error::new("Transaction missing required signatures"));
    }
    
    info!("Transaction has required signatures: {} signatures found", transaction.signatures.len());
    
    // Step 3: Setup RPC client
    let rpc_url = &config.solana.rpc_url;
    let client = RpcClient::new_with_commitment(rpc_url.clone(), CommitmentConfig::confirmed());
    
    // Step 4: Submit the fully signed transaction to blockchain
    info!("Submitting multi-signed transaction to blockchain...");
    
    let signature = client.send_and_confirm_transaction(&transaction)
        .map_err(|e| async_graphql::Error::new(format!("Failed to execute transaction: {}", e)))?;
    
    info!("Token transfer executed successfully: {}", signature);
    
    Ok(signature.to_string())
}
