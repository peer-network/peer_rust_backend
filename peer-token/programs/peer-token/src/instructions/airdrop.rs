use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface, transfer},
};
use std::str::FromStr;

/// Struct to define recipient data
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RecipientData {
    /// Recipient's wallet address
    pub user_wallet: Pubkey,
    /// Number of tokens to transfer to this recipient
    pub token_amount: u64,
}

/// Handler for transferring tokens to a recipient
pub fn transfer_tokens_handler(ctx: Context<TransferTokens>, amount: u64) -> Result<()> {
    // Validate inputs
    require!(amount > 0, ErrorCode::InsufficientAmount);
    
    // Verify there are enough tokens to transfer
    let peer_balance = ctx.accounts.peer_token_account.amount;
    require!(
        amount <= peer_balance,
        ErrorCode::InsufficientFunds
    );
    
    // Transfer tokens from peer token account to user token account
    let cpi_accounts = anchor_spl::token_interface::Transfer {
        from: ctx.accounts.peer_token_account.to_account_info(),
        to: ctx.accounts.user_token_account.to_account_info(),
        authority: ctx.accounts.peer_authority.to_account_info(),
    };
    
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    
    transfer(cpi_ctx, amount)?;
    Ok(())
}
    
    // Get recipient's key for the event
    // let recipient_key = ctx.accounts.recipient.key();
    
    // Emit an event for this individual transfer
//     emit!(TransferEvent {
//         recipient: recipient_key,
//         amount,
//         timestamp: Clock::get()?.unix_timestamp,
//     });
    
//     Ok(())
 

// /// Simple initialization struct - just emits an event
// pub fn initialize_handler(ctx: Context<Initialize>) -> Result<()> {
//     emit!(InitEvent {
//         authority: ctx.accounts.authority.key(),
//         timestamp: Clock::get()?.unix_timestamp,
//     });
//     Ok(())
// }

/// Simple initialization struct
// #[derive(Accounts)]
// pub struct Initialize<'info> {
//     /// The authority (signer) that will perform transfers
//     #[account(mut)]
//     pub peer_authority: Signer<'info>,
    
//     /// System program
//     pub system_program: Program<'info, System>,
// }

/// Accounts required for token transfer
#[derive(Accounts)]
pub struct TransferTokens<'info> {
    #[account(mut)]
    pub peer_authority: Signer<'info>,

    /// CHECK: Validated in transfer instruction
    pub user_wallet: AccountInfo<'info>,
    
    pub peer_mint: InterfaceAccount<'info, Mint>,
    
    #[account(mut)]
    pub peer_token_account: InterfaceAccount<'info, TokenAccount>,
    
    #[account(
        mut,
        associated_token::mint = peer_mint,
        associated_token::authority = user_wallet,
        associated_token::token_program = token_program,
    )]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>,
    
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// Event emitted on initialization
// #[event]
// pub struct InitEvent {
//     /// Authority that will be distributing tokens
//     pub authority: Pubkey,
//     /// Creation timestamp
//     pub timestamp: i64,
// }

// /// Event emitted on each individual transfer
// #[event]
// pub struct TransferEvent {
//     /// Recipient wallet address
//     pub recipient: Pubkey,
//     /// Amount of tokens transferred
//     pub amount: u64,
//     /// Timestamp when transferred
//     pub timestamp: i64,
// }

/// Custom errors with descriptive messages
#[error_code]
pub enum ErrorCode {
    #[msg("Cannot transfer zero or insufficient amount")]
    InsufficientAmount,
    
    #[msg("Insufficient funds in peer token account")]
    InsufficientFunds,
    
    #[msg("Invalid mint account")]
    InvalidMint,
    
    #[msg("Invalid token account owner")]
    InvalidOwner,
}