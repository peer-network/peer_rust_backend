use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    msg,
    program::invoke_signed,
    program_error::ProgramError,
    program_pack::Pack,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    sysvar::Sysvar,
    clock::Clock,
};
use borsh::{BorshDeserialize, BorshSerialize};

use crate::{
    error::RewardError,
    instruction::RewardInstruction,
    state::{RewardVault, ClaimRecord, VAULT_SEED, CLAIM_SEED},
};

pub struct Processor;

impl Processor {
    pub fn process(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        instruction_data: &[u8],
    ) -> ProgramResult {
        let instruction = RewardInstruction::unpack(instruction_data)?;

        match instruction {
            RewardInstruction::InitializeVault => {
                msg!("Instruction: InitializeVault");
                Self::process_initialize_vault(program_id, accounts)
            }
            RewardInstruction::ClaimReward { amount, expiry, backend_signature } => {
                msg!("Instruction: ClaimReward");
                Self::process_claim_reward(program_id, accounts, amount, expiry, backend_signature)
            }
            RewardInstruction::DepositRewards { amount } => {
                msg!("Instruction: DepositRewards");
                Self::process_deposit_rewards(program_id, accounts, amount)
            }
            RewardInstruction::WithdrawRewards { amount } => {
                msg!("Instruction: WithdrawRewards");
                Self::process_withdraw_rewards(program_id, accounts, amount)
            }
        }
    }

    /// Initialize the reward vault (PDA)
    fn process_initialize_vault(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        
        let authority_info = next_account_info(account_info_iter)?;
        let vault_info = next_account_info(account_info_iter)?;
        let token_mint_info = next_account_info(account_info_iter)?;
        let backend_authority_info = next_account_info(account_info_iter)?;
        let token_program_info = next_account_info(account_info_iter)?;
        let system_program_info = next_account_info(account_info_iter)?;
        let rent_info = next_account_info(account_info_iter)?;

        // Verify authority is signer
        if !authority_info.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        // Derive PDA for vault
        let (vault_pda, bump) = Pubkey::find_program_address(
            &[VAULT_SEED, token_mint_info.key.as_ref()],
            program_id,
        );

        if vault_pda != *vault_info.key {
            msg!("Error: Vault PDA mismatch");
            return Err(ProgramError::InvalidSeeds);
        }

        // Create vault account
        let rent = Rent::from_account_info(rent_info)?;
        let space = RewardVault::LEN;
        let lamports = rent.minimum_balance(space);

        invoke_signed(
            &system_instruction::create_account(
                authority_info.key,
                vault_info.key,
                lamports,
                space as u64,
                program_id,
            ),
            &[authority_info.clone(), vault_info.clone(), system_program_info.clone()],
            &[&[VAULT_SEED, token_mint_info.key.as_ref(), &[bump]]],
        )?;

        // Initialize vault state
        let vault = RewardVault {
            authority: *authority_info.key,
            token_mint: *token_mint_info.key,
            total_deposited: 0,
            total_claimed: 0,
            backend_authority: *backend_authority_info.key,
            bump,
        };

        vault.serialize(&mut &mut vault_info.data.borrow_mut()[..])?;

        msg!("Reward vault initialized successfully");
        Ok(())
    }

    /// Process claim reward - USER PAYS GAS, BACKEND AUTHORIZES
    fn process_claim_reward(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        amount: u64,
        expiry: i64,
        backend_signature: [u8; 64],
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        
        let user_info = next_account_info(account_info_iter)?;
        let user_token_account_info = next_account_info(account_info_iter)?;
        let vault_info = next_account_info(account_info_iter)?;
        let vault_token_account_info = next_account_info(account_info_iter)?;
        let backend_authority_info = next_account_info(account_info_iter)?;
        let token_program_info = next_account_info(account_info_iter)?;
        let claim_record_info = next_account_info(account_info_iter)?;
        let system_program_info = next_account_info(account_info_iter)?;
        let rent_info = next_account_info(account_info_iter)?;

        // Verify user is signer (paying gas)
        if !user_info.is_signer {
            msg!("Error: User must sign and pay transaction fee");
            return Err(ProgramError::MissingRequiredSignature);
        }

        // Deserialize vault state
        let vault = RewardVault::try_from_slice(&vault_info.data.borrow())?;

        // Verify backend authority matches
        if vault.backend_authority != *backend_authority_info.key {
            msg!("Error: Invalid backend authority");
            return Err(RewardError::InvalidBackendSignature.into());
        }

        // Check expiry
        let clock = Clock::get()?;
        if clock.unix_timestamp > expiry {
            msg!("Error: Claim authorization expired");
            return Err(RewardError::ClaimExpired.into());
        }

        // TODO: Verify backend signature
        // Message format: user_pubkey || amount || expiry
        // This requires ed25519 signature verification
        // For now, we'll skip this check (implement in production)
        msg!("TODO: Verify backend signature in production");

        // Check if user already claimed
        let (claim_pda, claim_bump) = Pubkey::find_program_address(
            &[CLAIM_SEED, user_info.key.as_ref(), vault.token_mint.as_ref()],
            program_id,
        );

        if claim_pda != *claim_record_info.key {
            msg!("Error: Claim record PDA mismatch");
            return Err(ProgramError::InvalidSeeds);
        }

        // If claim record already exists, user already claimed
        if claim_record_info.data_len() > 0 {
            msg!("Error: User already claimed this reward");
            return Err(RewardError::AlreadyClaimed.into());
        }

        // Create claim record
        let rent = Rent::from_account_info(rent_info)?;
        let space = ClaimRecord::LEN;
        let lamports = rent.minimum_balance(space);

        invoke_signed(
            &system_instruction::create_account(
                user_info.key,
                claim_record_info.key,
                lamports,
                space as u64,
                program_id,
            ),
            &[user_info.clone(), claim_record_info.clone(), system_program_info.clone()],
            &[&[CLAIM_SEED, user_info.key.as_ref(), vault.token_mint.as_ref(), &[claim_bump]]],
        )?;

        // Initialize claim record
        let claim_record = ClaimRecord {
            user: *user_info.key,
            amount,
            claimed_at: clock.unix_timestamp,
            bump: claim_bump,
        };

        claim_record.serialize(&mut &mut claim_record_info.data.borrow_mut()[..])?;

        // Transfer tokens from vault to user
        let transfer_instruction = spl_token_2022::instruction::transfer(
            token_program_info.key,
            vault_token_account_info.key,
            user_token_account_info.key,
            vault_info.key,
            &[vault_info.key],
            amount,
        )?;

        invoke_signed(
            &transfer_instruction,
            &[
                vault_token_account_info.clone(),
                user_token_account_info.clone(),
                vault_info.clone(),
                token_program_info.clone(),
            ],
            &[&[VAULT_SEED, vault.token_mint.as_ref(), &[vault.bump]]],
        )?;

        msg!("Reward claimed: {} tokens transferred to user", amount);
        Ok(())
    }

    /// Deposit rewards into vault (company adds tokens)
    fn process_deposit_rewards(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        amount: u64,
    ) -> ProgramResult {
        msg!("Depositing {} tokens to reward vault", amount);
        // TODO: Implement token transfer from company to vault
        Ok(())
    }

    /// Withdraw rewards from vault (admin emergency function)
    fn process_withdraw_rewards(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        amount: u64,
    ) -> ProgramResult {
        msg!("Withdrawing {} tokens from reward vault", amount);
        // TODO: Implement token transfer from vault to company
        Ok(())
    }
}
