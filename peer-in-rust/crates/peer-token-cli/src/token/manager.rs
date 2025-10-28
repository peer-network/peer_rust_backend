
use std::path::Path;
use std::fs;
use serde::{Deserialize, Serialize};
use tracing::{info, warn, error, debug, instrument};
use solana_client::rpc_client::RpcClient;
use solana_sdk::{
    commitment_config::CommitmentConfig,
    pubkey::Pubkey,
};
use spl_token_2022::{
    extension::StateWithExtensions,
    state::Mint,
};
use std::str::FromStr;

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

use peer_common::utils::errors::{Result, PlatformError, TokenError};
use crate::token::{
    config::TokenConfig,
    creator::PeerTokenCreator,
    types::{TokenResult, TokenStatus, TokenCreationStats},
    validation::TokenValidator,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TokenState {
    pub status: TokenStatus,
    pub result: Option<TokenResult>,
    pub creation_timestamp: Option<i64>,
    pub lock_timestamp: Option<i64>,
    pub creation_stats: Option<TokenCreationStats>,
}

impl Default for TokenState {
    fn default() -> Self {
        Self {
            status: TokenStatus::NotCreated,
            result: None,
            creation_timestamp: None,
            lock_timestamp: None,
            creation_stats: None,
        }
    }
}

pub struct TokenManager {
    config: TokenConfig,
    state_file_path: String,
    state: TokenState,
    rpc_client: RpcClient,  
}

impl TokenManager {
   
    #[instrument(skip(config))]
    pub fn new(config: TokenConfig) -> Result<Self> {
        info!("Initializing token manager");

        let state_file_path = format!("data/token_state_{}.json", config.cluster);
        
        if let Some(parent) = Path::new(&state_file_path).parent() {
            fs::create_dir_all(parent)
                .map_err(|e| PlatformError::Token(TokenError::TransactionFailed(
                    format!("Failed to create data directory: {}", e)
                )))?;
        }


        let rpc_client = RpcClient::new_with_commitment(
            config.rpc_url.clone(),
            CommitmentConfig::confirmed(),
        );
        debug!("RPC client initialized: {}", config.rpc_url);

        let mut manager = Self {
            config,
            state_file_path,
            state: TokenState::default(),
            rpc_client,  
        };

        manager.load_state()?;

        info!("Token manager initialized");
        debug!("State file: {}", manager.state_file_path);
        debug!("Current status: {:?}", manager.state.status);

        Ok(manager)
    }

     pub fn get_creation_timestamp(&self) -> Option<i64> {
        self.state.creation_timestamp
    }

    #[instrument(skip(self))]
    pub async fn create_token(&mut self) -> Result<TokenResult> {

        info!("Initiating PEER token creation with protection checks");

        self.validate_creation_eligibility()?;
        self.state.status = TokenStatus::Created;
        self.state.creation_timestamp = Some(chrono::Utc::now().timestamp());
        self.save_state()?;

        info!("Token creation state locked - preventing concurrent attempts");


        match self.execute_token_creation().await {
            Ok(result) => {

                self.state.result = Some(result.clone());
                self.save_state()?;
                
                info!("Token creation completed successfully");
                info!("Explorer: {}", result.get_explorer_url());
                
                Ok(result)
            },
            Err(e) => {
                error!("Token creation failed: {}", e);
                self.state.status = TokenStatus::Error(e.to_string());
                self.save_state()?;
                
                Err(e)
            }
        }
    }

    #[instrument(skip(self))]
    pub async fn lock_mint(&mut self) -> Result<()> {
        info!("Initiating mint lock operation (IRREVERSIBLE)");

        match &self.state.status {
            TokenStatus::Created => {
                info!("Token exists and can be locked");
            },
            TokenStatus::MintLocked => {
                warn!("Mint is already locked");
                return Err(PlatformError::Token(TokenError::TokenAlreadyExists));
            },
            TokenStatus::NotCreated => {
                error!("Cannot lock mint: token not created");
                return Err(PlatformError::Token(TokenError::TransactionFailed(
                    "Token must be created before locking mint".to_string()
                )));
            },
            TokenStatus::Error(msg) => {
                error!("Cannot lock mint: token in error state: {}", msg);
                return Err(PlatformError::Token(TokenError::TransactionFailed(
                    format!("Cannot lock mint while in error state: {}", msg)
                )));
            }
        }

        warn!("Mint locking not yet implemented - state will be updated only");


        self.state.status = TokenStatus::MintLocked;
        self.state.lock_timestamp = Some(chrono::Utc::now().timestamp());
        self.save_state()?;

        info!("Mint locked successfully (state updated)");
        Ok(())
    }


    pub fn get_status(&self) -> &TokenStatus {
        &self.state.status
    }


    pub fn get_result(&self) -> Option<&TokenResult> {
        self.state.result.as_ref()
    }


    pub fn get_creation_stats(&self) -> Option<&TokenCreationStats> {
        self.state.creation_stats.as_ref()
    }


    #[instrument(skip(self))]
    fn validate_creation_eligibility(&self) -> Result<()> {
        info!("Validating token creation eligibility");

        TokenValidator::validate_can_create_token(&self.state.status)?;


        if let Some(timestamp) = self.state.creation_timestamp {
            let age_hours = (chrono::Utc::now().timestamp() - timestamp) / 3600;
            if age_hours < 1 && matches!(self.state.status, TokenStatus::Error(_)) {
                warn!("Recent creation attempt failed {} hours ago", age_hours);
            }
        }

        info!("Token creation eligibility validated");
        Ok(())
    }


    #[instrument(skip(self))]
    async fn execute_token_creation(&mut self) -> Result<TokenResult> {
        info!("Executing token creation process");


        let mut creator = PeerTokenCreator::from_config(self.config.clone()).await?;



        let result = creator.create_peer_token().await?;


        creator.calculate_total_cost();
        self.state.creation_stats = Some(creator.get_stats().clone());

        info!("Token creation process completed");
        Ok(result)
    }


    #[instrument(skip(self))]
    fn load_state(&mut self) -> Result<()> {
        
        if !Path::new(&self.state_file_path).exists() {
            debug!("No existing state file found, using default state");
            return Ok(());
        }

        debug!("Loading token state from: {}", self.state_file_path);

        let state_content = fs::read_to_string(&self.state_file_path)
            .map_err(|e| PlatformError::Token(TokenError::TransactionFailed(
                format!("Failed to read state file: {}", e)
            )))?;

        self.state = serde_json::from_str(&state_content)
            .map_err(|e| PlatformError::Token(TokenError::TransactionFailed(
                format!("Failed to parse state file: {}", e)
            )))?;

        info!("Token state loaded from file");
        debug!("Loaded state: {:?}", self.state.status);



        match &self.state.status {
            TokenStatus::Created | TokenStatus::MintLocked => {
                info!(" Verifying token state against Solana blockchain...");
                
                if let Some(result) = &self.state.result {
                    match self.verify_token_on_blockchain(&result.mint_address) {
                        Ok(true) => {
                            info!(" Blockchain verification PASSED - token is legitimate");
                        },
                        Ok(false) => {
                            error!(" Blockchain verification FAILED - token doesn't exist or is invalid");
                            warn!("Resetting state file to NotCreated (possible tampering detected)");
                            self.state = TokenState::default();
                            self.save_state()?;
                        },
                        Err(e) => {
                            warn!(" Blockchain verification error (RPC issue?): {}", e);
                            warn!("Continuing with cached state, but verification recommended");
                        }
                    }
                } else {
                    error!(" State says 'Created' but no token result found - corrupted state");
                    warn!("Resetting state file to NotCreated");
                    self.state = TokenState::default();
                    self.save_state()?;
                }
            },
            TokenStatus::NotCreated => {
                debug!("Token not created yet, no blockchain verification needed");
            },
            TokenStatus::Error(_) => {
                debug!("Token in error state, no blockchain verification needed");
            }
        }
        
        Ok(())
    }


    #[instrument(skip(self))]
    fn save_state(&self) -> Result<()> {
        debug!("Saving token state to: {}", self.state_file_path);

        let state_content = serde_json::to_string_pretty(&self.state)
            .map_err(|e| PlatformError::Token(TokenError::TransactionFailed(
                format!("Failed to serialize state: {}", e)
            )))?;

        fs::write(&self.state_file_path, state_content)
            .map_err(|e| PlatformError::Token(TokenError::TransactionFailed(
                format!("Failed to write state file: {}", e)
            )))?;

       
        #[cfg(unix)]
        {
            let mut perms = fs::metadata(&self.state_file_path)
                .map_err(|e| PlatformError::Token(TokenError::TransactionFailed(
                    format!("Failed to read file metadata: {}", e)
                )))?
                .permissions();
            
            perms.set_mode(0o600);  
            
            fs::set_permissions(&self.state_file_path, perms)
                .map_err(|e| PlatformError::Token(TokenError::TransactionFailed(
                    format!("Failed to set file permissions: {}", e)
                )))?;
            
            debug!("File permissions set to 600 (owner read/write only)");
        }

        debug!("Token state saved successfully");
        Ok(())
    }

   
    #[instrument(skip(self))]
    fn verify_token_on_blockchain(&self, mint_address: &str) -> Result<bool> {
        info!("Verifying token on blockchain: {}", mint_address);


        let mint_pubkey = Pubkey::from_str(mint_address)
            .map_err(|e| PlatformError::Token(TokenError::TransactionFailed(
                format!("Invalid mint address: {}", e)
            )))?;


        let account_data = match self.rpc_client.get_account_data(&mint_pubkey) {
            Ok(data) => data,
            Err(e) => {
                warn!("Failed to fetch account data: {}", e);
                return Ok(false);  
            }
        };

        debug!("Account data fetched, size: {} bytes", account_data.len());


        match StateWithExtensions::<Mint>::unpack(&account_data) {
            Ok(mint_state) => {
                let mint = mint_state.base;
                
                info!(" Valid SPL Token-2022 mint found");
                debug!("Mint authority: {:?}", mint.mint_authority);
                debug!("Supply: {}", mint.supply);
                debug!("Decimals: {}", mint.decimals);
                debug!("Is initialized: {}", mint.is_initialized);


                if !mint.is_initialized {
                    error!("Token mint exists but is not initialized");
                    return Ok(false);
                }


                if mint.decimals != self.config.token_decimals {
                    error!(
                        "Token decimals mismatch - Expected: {}, Found: {}",
                        self.config.token_decimals,
                        mint.decimals
                    );
                    warn!("This might not be your PEER token!");
                }


                if let Some(result) = &self.state.result {
                    match self.verify_admin_token_account(&result.admin_token_account, &mint_pubkey) {
                        Ok(true) => info!(" Admin token account verified"),
                        Ok(false) => warn!(" Admin token account verification failed"),
                        Err(e) => warn!("  Could not verify admin account: {}", e),
                    }
                }

                info!(" Blockchain verification successful");
                Ok(true)
            },
            Err(e) => {
                error!("Failed to parse mint account data: {}", e);
                error!("Account exists but is not a valid SPL Token-2022 mint");
                Ok(false)
            }
        }
    }

    #[instrument(skip(self))]
    fn verify_admin_token_account(&self, token_account: &str, mint_pubkey: &Pubkey) -> Result<bool> {
        debug!("Verifying admin token account: {}", token_account);

        let token_account_pubkey = Pubkey::from_str(token_account)
            .map_err(|e| PlatformError::Token(TokenError::TransactionFailed(
                format!("Invalid token account address: {}", e)
            )))?;

        match self.rpc_client.get_token_account_balance(&token_account_pubkey) {
            Ok(balance) => {
                info!("Admin token account balance: {} tokens", balance.ui_amount_string);
                
                if balance.amount.parse::<u64>().unwrap_or(0) > 0 {
                    info!("  Admin has tokens - verification passed");
                    Ok(true)
                } else {
                    warn!(" Admin token account exists but has 0 balance");
                    Ok(false)
                }
            },
            Err(e) => {
                warn!("Failed to get token account balance: {}", e);
                Ok(false)
            }
        }
    }

    #[instrument(skip(self))]
    pub fn reset_state(&mut self) -> Result<()> {
        warn!("DANGER: Resetting token state (development only)");

        self.state = TokenState::default();
        self.save_state()?;

        warn!("Token state reset to default");
        Ok(())
    }

    pub fn get_status_report(&self) -> String {
        let status_emoji = match self.state.status {
            TokenStatus::NotCreated => "NOT_CREATED",
            TokenStatus::Created => "CREATED",
            TokenStatus::MintLocked => "LOCKED",
            TokenStatus::Error(_) => "ERROR",
        };

        let mut report = format!("{} Token Status: {:?}\n", status_emoji, self.state.status);

        if let Some(result) = &self.state.result {
            report.push_str(&format!(
                "Mint Address: {}\n\
                 Admin Account: {}\n\
                 Initial Supply: {} PEER\n\
                 Cluster: {}\n\
                 Explorer: {}\n",
                result.mint_address,
                result.admin_token_account,
                result.initial_supply,
                result.cluster,
                result.get_explorer_url()
            ));
        }

        if let Some(timestamp) = self.state.creation_timestamp {
            let datetime = chrono::DateTime::from_timestamp(timestamp, 0)
                .unwrap_or_default();
            report.push_str(&format!("Created: {}\n", datetime.format("%Y-%m-%d %H:%M:%S UTC")));
        }

        if let Some(timestamp) = self.state.lock_timestamp {
            let datetime = chrono::DateTime::from_timestamp(timestamp, 0)
                .unwrap_or_default();
            report.push_str(&format!("Locked: {}\n", datetime.format("%Y-%m-%d %H:%M:%S UTC")));
        }

        if let Some(stats) = &self.state.creation_stats {
            report.push_str(&format!(
                "\nCreation Statistics:\n\
                 Total Cost: {:.6} SOL\n\
                 Transactions: {}\n\
                 Duration: {}ms\n",
                stats.total_cost_sol,
                stats.total_transactions,
                stats.creation_duration_ms
            ));
        }

        report
    }
}