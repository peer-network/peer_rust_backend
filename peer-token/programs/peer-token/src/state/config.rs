use anchor_lang::prelude::*;
use anchor_spl::associated_token::get_associated_token_address;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub struct FeeParams {
    pub burn_percent: u16,      // In basis points (100 = 1%)
    pub company_percent: u16,   
    pub lp_percent: u16,        
    pub referral_percent: u16,  
    pub gas_fee_amount: u64,       // Fixed amount for gas fees 
}

impl FeeParams { 
    pub const FEESPACE : usize = 2 + 2 + 2 + 2 + 8; //16
    }


#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub struct SystemWallets { 
    pub minting_wallet: Pubkey, 
    pub treasury_wallet: Pubkey,
    pub lp_wallet: Pubkey,
    pub fee_wallet: Pubkey,
}
impl SystemWallets {
    pub const WALLETSPACE : usize =  32 + 32 + 32 + 32; //128

    // Derive ATAs from wallet pubkeys (References)
    pub fn get_treasury_ata(&self, mint: &Pubkey) -> Pubkey {
        get_associated_token_address(&self.treasury_wallet, mint)
    }
     
    pub fn get_lp_ata(&self, mint: &Pubkey) -> Pubkey {
        get_associated_token_address(&self.lp_wallet, mint)
    }
    
    pub fn get_fee_ata(&self, mint: &Pubkey) -> Pubkey {
        get_associated_token_address(&self.fee_wallet, mint)
    }
    
    pub fn get_minting_ata(&self, mint: &Pubkey) -> Pubkey {
        get_associated_token_address(&self.minting_wallet, mint)
    }
}

//Mint config 
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub struct TokenConfig {  
    pub peer_mint: Pubkey,
    pub daily_mint_amount: u64 ,
    pub last_mint_reset: i64,
}

impl TokenConfig {
    pub const TOKENSPACE : usize = 32 + 8 + 8; //48
}

//Program admin controls
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub struct ProgramState {  
    pub peer_admin: Pubkey,
    pub peer_admin_2: Pubkey,
    pub is_paused: bool,
}

impl ProgramState {
    pub const PROGRAMSPACE : usize = 32 + 32 + 1; //65
}

//Root config a/c
#[account]
pub struct ProgramConfig {

    pub fees: FeeParams,     // Fee percentages
    pub wallets: SystemWallets,     
    pub token: TokenConfig,       
    pub program: ProgramState, 
    pub reserved: [u64; 4],

}

impl ProgramConfig {
    pub const SPACE: usize = 8 // discriminator
    + FeeParams::FEESPACE
    + SystemWallets::WALLETSPACE
    + TokenConfig::TOKENSPACE
    + ProgramState::PROGRAMSPACE 
    + (8 * 4); // reserved 

    }


 






// #[derive(AnchorSerialize, AnchorDeserialize, Clone)]
// pub struct Airdrop_Schedule {
//     //Airdrop Related 
//     pub total_gems: u64,
//     // pub recipients: Vec<AirdropRecipient>,
//     pub total_distributed: u64,
//     pub is_active: bool,
//     pub bump: u8,
// }

// impl Airdrop_Schedule {
//     pub const SPACE : usize = 8 + 8 + 4 + (32 + 8) * 1000 + 8 + 1 + 1;
// }



