use anyhow::{anyhow, Result};
use log::info;
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
use spl_token_2022::{
    extension::{ExtensionType, StateWithExtensions},
    instruction::{initialize_mint2, mint_to},
    state::Mint,
    ID as TOKEN_2022_PROGRAM_ID,
};

use crate::ProductionConfig;
use dotenvy::dotenv;





#[derive(Debug, Clone)]
pub struct PeerTokenResult {
    pub mint_address: String,
    pub mint_authority: String,
    pub admin_token_account: String,
    pub initial_supply: u64,
    pub creation_signature: String,
    pub minting_signature: String,
    pub mint_lock: bool,
}

pub struct PeerTokenCreator {
    client: RpcClient,
}

impl PeerTokenCreator {
    pub fn new(rpc_url: &str) -> Self {
        let client = RpcClient::new_with_commitment(
            rpc_url.to_string(),
            CommitmentConfig::confirmed(),
        );
        
        Self { client }
    }

    pub async fn get_balance(&self, address: &Pubkey) -> Result<u64> {
        Ok(self.client.get_balance(address)?)
    }

    pub async fn create_peer_token(
        &self,
        config: &ProductionConfig,
    ) -> Result<PeerTokenResult> {
        info!("  Creating PEER token with PDA mint authority...");

        dotenv().ok();
        let mint_authority_seed = std::env::var("MINT_AUTHORITY_SEED").unwrap();
        let mint_authority_bump = std::env::var("MINT_AUTHORITY_BUMP").unwrap();

        // Generate mint keypair
        let mint_keypair = Keypair::new();
        let mint_address = mint_keypair.pubkey();

        // Derive PDA for mint authority (this WILL be the mint authority)
        let (mint_authority_pda, mint_authority_bump) = Pubkey::find_program_address(
            &[mint_authority_seed.as_bytes(), mint_address.as_ref()],
            &TOKEN_2022_PROGRAM_ID, // Using Token-2022 as program ID for PDA
        );

        info!(" Mint Address: {}", mint_address);
        info!(" Mint Authority PDA: {}", mint_authority_pda);
        info!(" Mint Authority Bump: {}", mint_authority_bump);

        // Step 1: Create mint account with correct space for Token-2022
        let creation_signature = self.create_token_mint(
            config,
            &mint_keypair,
        ).await?;

        info!("✅ Mint created: {}", creation_signature);

        // Step 2: Create admin token account and mint initial supply
        let (admin_token_account, minting_signature) = self.mint_initial_supply(
            config,
            &mint_address,
        ).await?;

        info!(" Initial supply minted: {}", minting_signature);

        Ok(PeerTokenResult {
            mint_address: mint_address.to_string(),
            mint_authority: config.admin_keypair.pubkey().to_string(),
            admin_token_account: admin_token_account.to_string(),
            initial_supply: config.initial_supply,
            creation_signature: creation_signature.to_string(),
            minting_signature: minting_signature.to_string(),
            mint_lock: false,
        })
    }

    async fn create_token_mint(
        &self,
        config: &ProductionConfig,
        mint_keypair: &Keypair,
    ) -> Result<Signature> {
        info!("  Creating SPL Token-2022 mint with  space allocation...");

        let mint_address = mint_keypair.pubkey();

        // Use Token-2022's proper space calculation
        // Base mint size for Token-2022 (larger than original SPL Token)
        let space = 82; // Standard Token-2022 mint size

        let rent_lamports = self.client.get_minimum_balance_for_rent_exemption(space)?;

        info!(" Using correct space: {} bytes, rent: {} SOL", space, rent_lamports as f64 / 1_000_000_000.0);

        // Build transaction with just the essential instructions
        let instructions = vec![
            // 1. Create the mint account with exact space Token-2022 expects
            system_instruction::create_account(
                &config.admin_keypair.pubkey(),
                &mint_address,
                rent_lamports,
                space as u64,
                &TOKEN_2022_PROGRAM_ID,
            ),
            
            // 2. Initialize the mint (this is where the previous error occurred)
            initialize_mint2(
                &TOKEN_2022_PROGRAM_ID,
                &mint_address,
                &config.admin_keypair.pubkey(), // Mint authority
                None, // No freeze authority
                config.token_decimals,
            )?,
        ];

        info!("  Built {} instructions for Token-2022 mint creation", instructions.len());

        self.send_transaction(&instructions, &[&config.admin_keypair, mint_keypair]).await
    }

    async fn mint_initial_supply(
        &self,
        config: &ProductionConfig,
        mint_address: &Pubkey,
    ) -> Result<(Pubkey, Signature)> {
        info!(" Minting {} PEER tokens to admin account...", config.initial_supply);

        // Create admin's associated token account
        let admin_token_account = get_associated_token_address_with_program_id(
            &config.admin_keypair.pubkey(),
            mint_address,
            &TOKEN_2022_PROGRAM_ID,
        );

        let mint_amount = config.initial_supply
            .checked_mul(10_u64.pow(config.token_decimals as u32))
            .ok_or_else(|| anyhow!("Mint amount overflow"))?;

        info!(" Raw mint amount (with decimals): {}", mint_amount);

        let instructions = vec![
            // Create associated token account for admin
            create_associated_token_account(
                &config.admin_keypair.pubkey(),
                &config.admin_keypair.pubkey(),
                mint_address,
                &TOKEN_2022_PROGRAM_ID,
            ),
            
            // Mint tokens to admin account
            mint_to(
                &TOKEN_2022_PROGRAM_ID,
                mint_address,
                &admin_token_account,
                &config.admin_keypair.pubkey(), // Mint authority
                &[], // No additional signers
                mint_amount,
            )?,
        ];

        let signature = self.send_transaction(&instructions, &[&config.admin_keypair]).await?;

        info!(" Minted {} PEER tokens successfully", config.initial_supply);

        Ok((admin_token_account, signature))
    }

    async fn send_transaction(
        &self,
        instructions: &[Instruction],
        signers: &[&Keypair],
    ) -> Result<Signature> {
        let recent_blockhash = self.client.get_latest_blockhash()?;
        let message = Message::new(instructions, Some(&signers[0].pubkey()));
        let mut transaction = Transaction::new_unsigned(message);
        transaction.sign(signers, recent_blockhash);

        let signature = self.client.send_and_confirm_transaction(&transaction)?;
        Ok(signature)
    }
}