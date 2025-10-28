use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::program_error::ProgramError;

/// Instructions supported by the reward program
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub enum RewardInstruction {
    /// Initialize the reward vault (PDA)
    /// 
    /// Accounts expected:
    /// 0. `[writable, signer]` Authority (company wallet)
    /// 1. `[writable]` Reward vault (PDA)
    /// 2. `[]` Token mint
    /// 3. `[]` Token program
    /// 4. `[]` System program
    /// 5. `[]` Rent sysvar
    InitializeVault,

    /// Claim reward tokens
    /// User pays gas, backend signature authorizes the claim
    /// 
    /// Accounts expected:
    /// 0. `[signer]` User (fee payer)
    /// 1. `[writable]` User's token account
    /// 2. `[writable]` Reward vault (PDA)
    /// 3. `[]` Backend authority pubkey (for signature verification)
    /// 4. `[]` Token program
    /// 5. `[writable]` Claim record (PDA) - tracks if user already claimed
    /// 6. `[]` System program
    ClaimReward {
        /// Amount of tokens to claim
        amount: u64,
        /// Timestamp when this claim authorization expires
        expiry: i64,
        /// Backend signature (64 bytes ed25519 signature)
        backend_signature: [u8; 64],
    },

    /// Deposit tokens into vault (company adds rewards)
    /// 
    /// Accounts expected:
    /// 0. `[signer]` Authority (company wallet)
    /// 1. `[writable]` Source token account
    /// 2. `[writable]` Reward vault (PDA)
    /// 3. `[]` Token program
    DepositRewards {
        amount: u64,
    },

    /// Withdraw tokens from vault (emergency/admin)
    /// 
    /// Accounts expected:
    /// 0. `[signer]` Authority (company wallet)
    /// 1. `[writable]` Reward vault (PDA)
    /// 2. `[writable]` Destination token account
    /// 3. `[]` Token program
    WithdrawRewards {
        amount: u64,
    },
}

impl RewardInstruction {
    /// Deserialize instruction from bytes
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        Self::try_from_slice(input).map_err(|_| ProgramError::InvalidInstructionData)
    }

    /// Serialize instruction to bytes
    pub fn pack(&self) -> Vec<u8> {
        self.try_to_vec().unwrap()
    }
}
