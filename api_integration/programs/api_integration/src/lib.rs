use anchor_lang::prelude::*;

declare_id!("ByB8NvWuXWG5KCw5MPY2kV478UY9VnVzhyss9bXPGYkb");


#[program]
pub mod api_integration {
    use super::*;

    // Initialize a new data account with the fetched information
    pub fn initialize(
        ctx: Context<Initialize>, 
        data: String  // Store the entire data as a JSON string
    ) -> Result<()> {
        msg!("Starting account initialization");
        let data_account = &mut ctx.accounts.data_account;
        
        msg!("Data account key: {}", data_account.key());
        msg!("User key: {}", ctx.accounts.user.key());
        msg!("Data length: {}", data.len());
        
        // Validate data length
        require!(
            data.len() <= 8192,
            ErrorCode::DataTooLarge
        );
        
        // Store the data in the account
        data_account.data = data;
        data_account.owner = ctx.accounts.user.key();
        
        msg!("Data stored successfully in account {}", data_account.key());
        Ok(())
    }
    
    // Optional: Add an update function to modify existing data
    pub fn update(
        ctx: Context<Update>, 
        data: String
    ) -> Result<()> {
        let data_account = &mut ctx.accounts.data_account;
        
        // Verify the user is the owner of this data
        require!(
            data_account.owner == ctx.accounts.user.key(),
            ErrorCode::Unauthorized
        );
        
        // Update the data
        data_account.data = data;
        
        msg!("Data updated successfully");
        Ok(())
    }
}

// Context for the initialize instruction
#[derive(Accounts)]
pub struct Initialize<'info> {
    // The account that will store our data
    #[account(
        init, 
        payer = user, 
        space = 8 + 8192 + 32, // Discriminator (8) + data (8KB) + owner (32)
        seeds = [b"data", user.key().as_ref()],
        bump
    )]
    pub data_account: Account<'info, DataAccount>,
    
    // The user creating and paying for the account
    #[account(mut)]
    pub user: Signer<'info>,
    
    // Required by the runtime
    pub system_program: Program<'info, System>,
}

// Context for the update instruction
#[derive(Accounts)]
pub struct Update<'info> {
    // The data account to update
    #[account(mut)]
    pub data_account: Account<'info, DataAccount>,
    
    // The user must sign the transaction
    pub user: Signer<'info>,
}

// The structure that defines our data storage format
#[account]
pub struct DataAccount {
    pub data: String,     // Store the entire data as a JSON string (1KB max)
    pub owner: Pubkey,    // 32 bytes (wallet address)
}

// Custom error codes
#[error_code]
pub enum ErrorCode {
    #[msg("You are not authorized to update this data")]
    Unauthorized,
    #[msg("Data is too large for the account")]
    DataTooLarge,
}
