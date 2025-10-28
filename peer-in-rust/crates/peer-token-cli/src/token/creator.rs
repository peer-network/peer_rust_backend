
use solana_client::rpc_client::RpcClient;
use solana_sdk::{
    commitment_config::CommitmentConfig,
    instruction::Instruction,
    message::Message,
    pubkey::Pubkey,
    signature::{Keypair, Signature, Signer},
    system_instruction,
    transaction::Transaction,
};
use spl_associated_token_account::{
    get_associated_token_address_with_program_id,
    instruction::create_associated_token_account,
};
use spl_token_metadata_interface::state::Field;

use spl_token_2022::{
    extension::{
        metadata_pointer::instruction::initialize as initialize_metadata_pointer,
        ExtensionType,
    },
    instruction::{initialize_mint2, mint_to},
    state::Mint,
    ID as TOKEN_2022_PROGRAM_ID,
};
use spl_token_metadata_interface::{
    instruction as metadata_instruction,
    state::TokenMetadata,
};
use std::time::{Duration, Instant};
use tracing::{info, warn, debug, error, instrument};

use peer_common::utils::errors::{Result, PlatformError, TokenError};
use crate::token::{
    config::TokenConfig,
    types::{TokenResult, TokenCreationStats},
    validation::TokenValidator,
};

pub struct PeerTokenCreator {
    client: RpcClient,
    config: TokenConfig,
    stats: TokenCreationStats,
}

impl PeerTokenCreator {

   
    #[instrument(skip(config))]
    pub async fn from_config(config: TokenConfig) -> Result<Self> {
        info!(" Initializing PEER token creator from config");
        

        TokenValidator::validate_rpc_url(&config.rpc_url)?;

        let commitment = match config.commitment_level.as_str() {
            "processed" => CommitmentConfig::processed(),
            "confirmed" => CommitmentConfig::confirmed(),
            "finalized" => CommitmentConfig::finalized(),
            _ => {
                warn!("Unknown commitment level: {}, using 'confirmed'", config.commitment_level);
                CommitmentConfig::confirmed()
            }
        };

        let client = RpcClient::new_with_commitment(
            config.rpc_url.clone(),
            commitment,
        );

        let stats = TokenCreationStats {
            total_cost_sol: 0.0,
            mint_creation_cost: 0.0,
            account_creation_cost: 0.0,
            minting_cost: 0.0,
            total_transactions: 0,
            creation_duration_ms: 0,
        };

        info!("Token creator initialized for cluster: {}", config.cluster);
        debug!("RPC: {} | Commitment: {}", config.rpc_url, config.commitment_level);

        Ok(Self {
            client,
            config,
            stats,
        })
    }

    #[instrument(skip(self))]
    pub async fn get_balance(&self, address: &Pubkey) -> Result<u64> {
        debug!("Checking balance for: {}", address);
        
        self.client.get_balance(address)
            .map_err(|e| PlatformError::Token(TokenError::RpcError(
                format!("Failed to get balance: {}", e)
            )))
    }

    #[instrument(skip(self))]
    pub async fn create_peer_token(&mut self) -> Result<TokenResult> {
        let start_time = Instant::now();
        info!("Creating PEER token");
        info!("Configuration: {}", self.config.get_summary());

        // Step 1: Load and validate admin keypair
        let admin_keypair = self.config.load_admin_keypair()?;
        info!("Admin keypair loaded: {}", admin_keypair.pubkey());

        // Step 2: Check admin balance
        let balance = self.get_balance(&admin_keypair.pubkey()).await?;
        let min_balance = self.config.get_minimum_balance_requirement();
        
        TokenValidator::validate_minimum_balance(balance, min_balance)?;
        info!("Admin balance: {:.6} SOL (sufficient)", balance as f64 / 1_000_000_000.0);

        // Step 3: Generate mint keypair
        let mint_keypair = Keypair::new();
        let mint_address = mint_keypair.pubkey();
        info!("Generated mint address: {}", mint_address);

        // Step 4: Create mint account
        let creation_signature = self.create_token_mint(&admin_keypair, &mint_keypair).await?;
        info!("Mint created successfully: {}", creation_signature);

        // Step 5: Create admin token account and mint initial supply
        let (admin_token_account, minting_signature) = self.mint_initial_supply(
            &admin_keypair,
            &mint_address,
        ).await?;
        info!("Initial supply minted: {}", minting_signature);

        // Step 6: Calculate final statistics
        let creation_duration = start_time.elapsed();
        self.stats.creation_duration_ms = creation_duration.as_millis() as u64;

        let result = TokenResult {
            mint_address: mint_address.to_string(),
            mint_authority: admin_keypair.pubkey().to_string(),
            admin_token_account: admin_token_account.to_string(),
            initial_supply: self.config.initial_supply,
            creation_signature: creation_signature.to_string(),
            minting_signature: minting_signature.to_string(),
            mint_lock_status: false, // Not locked initially
            creation_timestamp: chrono::Utc::now().timestamp(),
            cluster: self.config.cluster.clone(),
        };

        info!("Explorer: {}", result.get_explorer_url());
        info!(" Token created in {}ms | Cost: {:.6} SOL", 
            self.stats.creation_duration_ms, self.stats.total_cost_sol);

        Ok(result)
    }


    #[instrument(skip(self, admin_keypair, mint_keypair))]
async fn create_token_mint(
    &mut self,
    admin_keypair: &Keypair,
    mint_keypair: &Keypair,
) -> Result<Signature> {
    info!("Creating Token-2022 mint with metadata extension");
    
    let mint_address = mint_keypair.pubkey();
    
    // STEP 1: Calculate mint space (with metadata pointer only)
    let mint_space = ExtensionType::try_calculate_account_len::<Mint>(&[
        ExtensionType::MetadataPointer
    ]).map_err(|e| PlatformError::Token(TokenError::TransactionFailed(
        format!("Failed to calculate mint space: {}", e)
    )))?;
    
    info!("Mint account space: {} bytes", mint_space);
    
    // STEP 2: Calculate metadata size
    let token_metadata = TokenMetadata {
        update_authority: Some(admin_keypair.pubkey()).try_into()
            .map_err(|e| PlatformError::Token(TokenError::TransactionFailed(
                format!("Failed to create update authority: {:?}", e)
            )))?,
        mint: mint_address,
        name: self.config.token_name.clone(),
        symbol: self.config.token_symbol.clone(),
        uri: self.config.token_image_uri.clone(), 
        additional_metadata: vec![
            ("description".to_string(), "Your token description".to_string()),
        ],
    };
    
    let metadata_len = token_metadata.tlv_size_of()
        .map_err(|e| PlatformError::Token(TokenError::TransactionFailed(
            format!("Failed to calculate metadata size: {:?}", e)
        )))?;
    
    info!("Metadata size: {} bytes", metadata_len);
    

    // STEP 3: Get rent for TOTAL space (mint + metadata)
    // But we only allocate mint_space initially
    let total_rent = self.client
        .get_minimum_balance_for_rent_exemption(mint_space + metadata_len)
        .map_err(|e| PlatformError::Token(TokenError::TransactionFailed(
            format!("Failed to get rent: {}", e)
        )))?;
    
    self.stats.mint_creation_cost = total_rent as f64 / 1_000_000_000.0;
    info!("Total rent (mint + metadata): {:.6} SOL", self.stats.mint_creation_cost);
    

    // STEP 4: Create account with TOTAL RENT but only MINT SPACE
    //  provide enough lamports for future realloc
    let create_account_ix = system_instruction::create_account(
        &admin_keypair.pubkey(),
        &mint_address,
        total_rent,              
        mint_space as u64,       
        &TOKEN_2022_PROGRAM_ID,
    );
    

    // STEP 5: Initialize metadata pointer (BEFORE mint)
    let init_metadata_pointer_ix = spl_token_2022::extension::metadata_pointer::instruction::initialize(
        &TOKEN_2022_PROGRAM_ID,
        &mint_address,
        Some(admin_keypair.pubkey()),  // Update authority
        Some(mint_address),             // Metadata address 
    ).map_err(|e| PlatformError::Token(TokenError::TransactionFailed(
        format!("Metadata pointer instruction failed: {}", e)
    )))?;
    
    // STEP 6: Initialize mint
    let init_mint_ix = initialize_mint2(
        &TOKEN_2022_PROGRAM_ID,
        &mint_address,
        &admin_keypair.pubkey(),  
        None,                      
        self.config.token_decimals,
    ).map_err(|e| PlatformError::Token(TokenError::TransactionFailed(
        format!("Initialize mint failed: {}", e)
    )))?;
    
    // STEP 7: Initialize metadata (will realloc automatically)
    let init_metadata_ix = metadata_instruction::initialize(
        &TOKEN_2022_PROGRAM_ID,
        &mint_address,                   
        &admin_keypair.pubkey(),         
        &mint_address,                   
        &admin_keypair.pubkey(),         
        token_metadata.name,
        token_metadata.symbol,
        token_metadata.uri,
    );
    
    // STEP 8: Send all instructions in ONE transaction
    let instructions = vec![
        create_account_ix,
        init_metadata_pointer_ix,
        init_mint_ix,
        init_metadata_ix,
    ];
    
    info!("Sending mint creation transaction (4 instructions)");
    
    let signature = self.send_transaction_with_retry(
        &instructions,
        &[admin_keypair, mint_keypair],
        "Mint Creation with Metadata",
    ).await?;
    
    self.stats.total_transactions += 1;
    info!(" Mint created with metadata: {}", signature);
    
    Ok(signature)
}


    #[instrument(skip(self, admin_keypair))]
    async fn mint_initial_supply(
        &mut self,
        admin_keypair: &Keypair,
        mint_address: &Pubkey,
    ) -> Result<(Pubkey, Signature)> {
        info!("Minting {} PEER tokens to admin account", self.config.initial_supply);

        let admin_token_account = get_associated_token_address_with_program_id(
            &admin_keypair.pubkey(),
            mint_address,
            &TOKEN_2022_PROGRAM_ID,
        );

        debug!("Admin token account: {}", admin_token_account);

        let mint_amount = self.config.get_token_amount_with_decimals()?;
        debug!("Raw mint amount (with decimals): {}", mint_amount);

        const ATA_SIZE: usize = 165;
        let ata_rent = self.client
            .get_minimum_balance_for_rent_exemption(ATA_SIZE)
            .map_err(|e| PlatformError::Token(TokenError::RpcError(
                format!("Failed to get ATA rent exemption: {}", e)
            )))?;

        self.stats.account_creation_cost = ata_rent as f64 / 1_000_000_000.0;

        let instructions = vec![
            create_associated_token_account(
                &admin_keypair.pubkey(), 
                &admin_keypair.pubkey(), 
                mint_address,
                &TOKEN_2022_PROGRAM_ID,
            ),
            
            mint_to(
                &TOKEN_2022_PROGRAM_ID,
                mint_address,
                &admin_token_account,
                &admin_keypair.pubkey(), 
                &[], 
                mint_amount,
            ).map_err(|e| PlatformError::Token(TokenError::TransactionFailed(
                format!("Failed to create mint_to instruction: {}", e)
            )))?,
        ];

        debug!("Built {} instructions for minting", instructions.len());

        let signature = self.send_transaction_with_retry(
            &instructions,
            &[admin_keypair],
            "Token Minting"
        ).await?;

        self.stats.total_transactions += 1;
        self.stats.minting_cost = 0.000005; 

        info!("Successfully minted {} PEER tokens", self.config.initial_supply);

        Ok((admin_token_account, signature))
    }


    #[instrument(skip(self, instructions, signers))]
    async fn send_transaction_with_retry(
        &self,
        instructions: &[Instruction],
        signers: &[&Keypair],
        operation_name: &str,
    ) -> Result<Signature> {
        info!("Sending transaction: {}", operation_name);

        for attempt in 1..=self.config.max_retries {
            debug!("Attempt {}/{} for: {}", attempt, self.config.max_retries, operation_name);

            match self.send_single_transaction(instructions, signers).await {
                Ok(signature) => {
                    info!("Transaction successful on attempt {}: {}", attempt, signature);
                    return Ok(signature);
                },
                Err(e) => {
                    if attempt == self.config.max_retries {
                        error!("Transaction failed after {} attempts: {}", self.config.max_retries, e);
                        return Err(e);
                    } else {
                        warn!("Transaction attempt {} failed: {}, retrying...", attempt, e);
                        tokio::time::sleep(Duration::from_secs(2)).await;
                    }
                }
            }
        }

        Err(PlatformError::Token(TokenError::TransactionFailed(
            format!("Transaction failed after {} retries", self.config.max_retries)
        )))
    }

    
    #[instrument(skip(self, instructions, signers))]
    async fn send_single_transaction(
        &self,
        instructions: &[Instruction],
        signers: &[&Keypair],
    ) -> Result<Signature> {

        let recent_blockhash = self.client.get_latest_blockhash()
            .map_err(|e| PlatformError::Token(TokenError::RpcError(
                format!("Failed to get blockhash: {}", e)
            )))?;

        let message = Message::new(instructions, Some(&signers[0].pubkey()));
        let mut transaction = Transaction::new_unsigned(message);
        transaction.sign(signers, recent_blockhash);

        debug!("Transaction size: {} bytes", transaction.message_data().len());

        let signature = self.client.send_and_confirm_transaction(&transaction)
            .map_err(|e| PlatformError::Token(TokenError::TransactionFailed(
                format!("Transaction failed: {}", e)
            )))?;

        Ok(signature)
    }

    pub fn get_stats(&self) -> &TokenCreationStats {
        &self.stats
    }

    pub fn calculate_total_cost(&mut self) {
        self.stats.total_cost_sol = self.stats.mint_creation_cost 
            + self.stats.account_creation_cost 
            + self.stats.minting_cost;
    }
}
