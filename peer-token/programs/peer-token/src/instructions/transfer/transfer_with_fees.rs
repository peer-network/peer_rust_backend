use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    TokenInterface, TokenAccount, Mint, TransferChecked, Burn, transfer_checked, burn
};
use anchor_spl::associated_token::get_associated_token_address;


use crate::{
    state::*,
    constants::*,
    errors::PeerTokenError,
    instructions::transfer::fee_calculator::TransferFeeBreakdown,
};


pub fn transfer_with_fees_handler(
    ctx: Context<TransferWithFees>,
    amount: u64,
) -> Result<()> {

    msg!(" Executing transfer with fee distribution...");
    
    let config = &ctx.accounts.program_config;
    
    // VALIDATIONS
    
    // Program operational check
    require!(!config.program.is_paused, PeerTokenError::UnauthorizedOperation);
    
    // Transfer amount validation
    require!(
        amount >= MIN_TRANSFER_AMOUNT && amount <= MAX_TRANSFER_AMOUNT,
        PeerTokenError::InvalidTransferAmount
    );
    
    // Prevent self-transfers
    require_keys_neq!(
        ctx.accounts.sender.key(),
        ctx.accounts.recipient.key(),
        PeerTokenError::InvalidRecipient
    );
    
    // Validate sender ATA
    require_eq!(
        ctx.accounts.sender_ata.owner,
        ctx.accounts.sender.key(),
        PeerTokenError::InvalidOwner
    );
    require_eq!(
        ctx.accounts.sender_ata.mint,
        config.token.peer_mint,
        PeerTokenError::InvalidMint
    );
    
    // Validate recipient ATA
    require_eq!(
        ctx.accounts.recipient_ata.mint,
        config.token.peer_mint,
        PeerTokenError::InvalidMint
    );


    // CALCULATE ALL FEES ATOMICALLY
    
    let fee_breakdown = TransferFeeBreakdown::calculate(amount, &config.fees)?;
    
    // Validate sender has sufficient balance
    fee_breakdown.validate_sufficient_balance(ctx.accounts.sender_ata.amount)?;
    
    msg!(" Fee breakdown calculated:");
    msg!("   Burn: {} tokens", fee_breakdown.burn_amount / 1_000_000_000);
    msg!("   Treasury: {} tokens", fee_breakdown.treasury_amount / 1_000_000_000);
    msg!("   LP: {} tokens", fee_breakdown.lp_amount / 1_000_000_000);
    msg!("   Referral: {} tokens", fee_breakdown.referral_amount / 1_000_000_000);
    msg!("   Gas: {} tokens", fee_breakdown.gas_fee_amount / 1_000_000_000);
    msg!("   Recipient: {} tokens", fee_breakdown.recipient_amount / 1_000_000_000);


    // EXECUTE ATOMIC OPERATIONS (All CPI calls in single transaction)
    
    // OPERATION 1: Burn tokens directly from sender 
    if fee_breakdown.burn_amount > 0 {
        let burn_cpi_accounts = Burn {
            mint: ctx.accounts.peer_mint.to_account_info(),
            from: ctx.accounts.sender_ata.to_account_info(),
            authority: ctx.accounts.sender.to_account_info(),
        };
        
        let burn_cpi_context = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            burn_cpi_accounts,
        );
        
        burn(burn_cpi_context, fee_breakdown.burn_amount)?;
        msg!(" Burned {} tokens directly", fee_breakdown.burn_amount / 1_000_000_000);
    }
    
    //  OPERATION 2: Transfer to treasury (CPI call)
    if fee_breakdown.treasury_amount > 0 {
        let transfer_cpi_accounts = TransferChecked {
            from: ctx.accounts.sender_ata.to_account_info(),
            to: ctx.accounts.treasury_ata.to_account_info(),
            authority: ctx.accounts.sender.to_account_info(),
            mint: ctx.accounts.peer_mint.to_account_info(),
        };
        
        let transfer_cpi_context = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            transfer_cpi_accounts,
        );
        
        transfer_checked(transfer_cpi_context, fee_breakdown.treasury_amount, ctx.accounts.peer_mint.decimals)?;
        msg!(" Transferred {} to treasury", fee_breakdown.treasury_amount / 1_000_000_000);
    }
    
    //  OPERATION 3: Transfer to LP (CPI call)
    if fee_breakdown.lp_amount > 0 {
        let transfer_cpi_accounts = TransferChecked {
            from: ctx.accounts.sender_ata.to_account_info(),
            to: ctx.accounts.lp_ata.to_account_info(),
            authority: ctx.accounts.sender.to_account_info(),
            mint: ctx.accounts.peer_mint.to_account_info(),
        };
        
        let transfer_cpi_context = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            transfer_cpi_accounts,
        );
        
        transfer_checked(transfer_cpi_context, fee_breakdown.lp_amount, ctx.accounts.peer_mint.decimals)?;
        msg!(" Transferred {} to LP", fee_breakdown.lp_amount / 1_000_000_000);
    }
    
    // OPERATION 4: Transfer to referral (CPI call)
    if fee_breakdown.referral_amount > 0 {
        let transfer_cpi_accounts = TransferChecked {
            from: ctx.accounts.sender_ata.to_account_info(),
            to: ctx.accounts.referral_ata.to_account_info(),
            authority: ctx.accounts.sender.to_account_info(),
            mint: ctx.accounts.peer_mint.to_account_info(),
        };
        
        let transfer_cpi_context = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            transfer_cpi_accounts,
        );
        
        transfer_checked(transfer_cpi_context, fee_breakdown.referral_amount, ctx.accounts.peer_mint.decimals)?;
        msg!(" Transferred {} to referral", fee_breakdown.referral_amount / 1_000_000_000);
    }
    
    // OPERATION 5: Transfer gas fee to fee wallet (CPI call)
    if fee_breakdown.gas_fee_amount > 0 {
        let transfer_cpi_accounts = TransferChecked {
            from: ctx.accounts.sender_ata.to_account_info(),
            to: ctx.accounts.fee_ata.to_account_info(),
            authority: ctx.accounts.sender.to_account_info(),
            mint: ctx.accounts.peer_mint.to_account_info(),
        };
        
        let transfer_cpi_context = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            transfer_cpi_accounts,
        );
        
        transfer_checked(transfer_cpi_context, fee_breakdown.gas_fee_amount, ctx.accounts.peer_mint.decimals)?;
        msg!(" Transferred {} to gas fee wallet", fee_breakdown.gas_fee_amount / 1_000_000_000);
    }
    
    //  OPERATION 6: Final transfer to recipient (CPI call)
    if fee_breakdown.recipient_amount > 0 {
        let transfer_cpi_accounts = TransferChecked {
            from: ctx.accounts.sender_ata.to_account_info(),
            to: ctx.accounts.recipient_ata.to_account_info(),
            authority: ctx.accounts.sender.to_account_info(),
            mint: ctx.accounts.peer_mint.to_account_info(),
        };
        
        let transfer_cpi_context = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            transfer_cpi_accounts,
        );
        
        transfer_checked(transfer_cpi_context, fee_breakdown.recipient_amount, ctx.accounts.peer_mint.decimals)?;
        msg!(" Transferred {} to recipient", fee_breakdown.recipient_amount / 1_000_000_000);
    }
    
    // EMIT  EVENT FOR MONITORING
    
    emit!(TransferWithFeesEvent {
        sender: ctx.accounts.sender.key(),
        recipient: ctx.accounts.recipient.key(),
        original_amount: fee_breakdown.original_amount,
        burn_amount: fee_breakdown.burn_amount,
        treasury_amount: fee_breakdown.treasury_amount,
        lp_amount: fee_breakdown.lp_amount,
        referral_amount: fee_breakdown.referral_amount,
        gas_fee_amount: fee_breakdown.gas_fee_amount,
        recipient_amount: fee_breakdown.recipient_amount,
        timestamp: Clock::get()?.unix_timestamp,
    });
    
    msg!(" Transfer with fees completed successfully!");
    msg!(" Summary: {} PEER → {} PEER delivered (fees distributed)", 
        amount / 1_000_000_000, 
        fee_breakdown.recipient_amount / 1_000_000_000
    );
    
    Ok(())
}

/// Transfer with fees account structure
#[derive(Accounts)]
pub struct TransferWithFees<'info> {
    /// Sender wallet (must sign)
    #[account(mut)]
    pub sender: Signer<'info>,
    
    /// Sender's token account
    #[account(
        mut,
        constraint = sender_ata.owner == sender.key() @ PeerTokenError::InvalidOwner,
        constraint = sender_ata.mint == program_config.token.peer_mint @ PeerTokenError::InvalidMint
    )]
    pub sender_ata: InterfaceAccount<'info, TokenAccount>,
    
    /// Recipient wallet (where final tokens go)
    /// CHECK: Validated in instruction logic
    pub recipient: UncheckedAccount<'info>,
    
    /// Recipient's token account
    #[account(
        mut,
        constraint = recipient_ata.mint == program_config.token.peer_mint @ PeerTokenError::InvalidMint
    )]
    pub recipient_ata: InterfaceAccount<'info, TokenAccount>,
    
    /// Program configuration
    #[account(
        seeds = [CONFIG_SEED],
        bump
    )]
    pub program_config: Account<'info, ProgramConfig>,
    
    /// Peer token mint (for burning)
    #[account(
        mut,
        seeds = [MINT_SEED],
        bump,
        constraint = peer_mint.key() == program_config.token.peer_mint @ PeerTokenError::InvalidMint
    )]
    pub peer_mint: InterfaceAccount<'info, Mint>,
    
    /// Treasury ATA (company fees)
    #[account(
        mut,
        constraint = treasury_ata.key() == 
            get_associated_token_address(&program_config.wallets.treasury_wallet, &program_config.token.peer_mint)
            @ PeerTokenError::InvalidTokenAccount,
        constraint = treasury_ata.mint == program_config.token.peer_mint @ PeerTokenError::InvalidMint
    )]
    pub treasury_ata: InterfaceAccount<'info, TokenAccount>,
    
    /// LP ATA (liquidity provider fees)
    #[account(
        mut,
        constraint = lp_ata.key() == 
            get_associated_token_address(&program_config.wallets.lp_wallet, &program_config.token.peer_mint)
            @ PeerTokenError::InvalidTokenAccount,
        constraint = lp_ata.mint == program_config.token.peer_mint @ PeerTokenError::InvalidMint
    )]
    pub lp_ata: InterfaceAccount<'info, TokenAccount>,
    
    /// Referral ATA (referral rewards) - using fee_wallet for now
    #[account(
        mut,
        constraint = referral_ata.key() == 
            get_associated_token_address(&program_config.wallets.fee_wallet, &program_config.token.peer_mint)  
            @ PeerTokenError::InvalidTokenAccount,
        constraint = referral_ata.mint == program_config.token.peer_mint @ PeerTokenError::InvalidMint
    )]
    pub referral_ata: InterfaceAccount<'info, TokenAccount>,
    
    /// Fee ATA (gas fee collection)
    #[account(
        mut,
        constraint = fee_ata.key() == 
            get_associated_token_address(&program_config.wallets.fee_wallet, &program_config.token.peer_mint)
            @ PeerTokenError::InvalidTokenAccount,
        constraint = fee_ata.mint == program_config.token.peer_mint @ PeerTokenError::InvalidMint
    )]
    pub fee_ata: InterfaceAccount<'info, TokenAccount>,
    
    /// Token program
    pub token_program: Interface<'info, TokenInterface>,
}

/// Transfer event for analytics
#[event]
pub struct TransferWithFeesEvent {
    pub sender: Pubkey,
    pub recipient: Pubkey,
    pub original_amount: u64,
    pub burn_amount: u64,
    pub treasury_amount: u64,
    pub lp_amount: u64,
    pub referral_amount: u64,
    pub gas_fee_amount: u64,
    pub recipient_amount: u64,
    pub timestamp: i64,
}
