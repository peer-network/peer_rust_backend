use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};
use anchor_spl::associated_token::AssociatedToken;
use crate::state::*;
use crate::constants::*;
use crate::errors::PeerTokenError;



#[derive(Accounts)]
pub struct InitializeSystemWallets<'info> {
    #[account(mut)]
    pub peer_admin: Signer<'info>,
    
    /// Peer mint (create_token.rs)
    #[account(
        seeds = [MINT_SEED], 
        bump
    )]
    pub peer_mint: InterfaceAccount<'info, Mint>,
    
    /// Program config (create_token.rs)
    #[account(
        mut,
        seeds = [CONFIG_SEED], 
        bump
    )]
    pub program_config: Account<'info, ProgramConfig>,
    

    // TREASURY WALLET - Company revenue collection (2% Fees)
    /// Company treasury ATA  (protocol fees)
    #[account(
        init,
        payer = peer_admin,
        associated_token::mint = peer_mint,
        associated_token::authority = treasury_wallet,
        associated_token::token_program = token_program
    )]
    pub treasury_ata: InterfaceAccount<'info, TokenAccount>,
    
    /// CHECK: Treasury wallet authority (company's revenue wallet)
    pub treasury_wallet: UncheckedAccount<'info>,
    

    // FEE WALLET - Sol Fee Payer ( Sol Fund )
    /// Fee  ATA for gas and Transfer fees Payer
    #[account(
        init,
        payer = peer_admin,
        associated_token::mint = peer_mint,
        associated_token::authority = fee_wallet,
        associated_token::token_program = token_program
    )]
    pub fee_ata: InterfaceAccount<'info, TokenAccount>,
    
    /// CHECK: Fee wallet authority 
    pub fee_wallet: UncheckedAccount<'info>,
    

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}





pub fn system_handler(ctx: Context<InitializeSystemWallets>) -> Result<()> {
    msg!(" Initializing system wallets (Treasury & Fee) for Peer Token...");
    
    let config = &mut ctx.accounts.program_config;
    let mint_pubkey = ctx.accounts.peer_mint.key();


    //Admin Authorization Check 
    require_eq!(
        ctx.accounts.peer_admin.key(),
        config.program.peer_admin,
        PeerTokenError::InvalidAuthority
    );


    // Validate mint consistency
    msg!(" Validating mint consistency...");
    require_keys_eq!(
        ctx.accounts.peer_mint.key(),
        config.token.peer_mint,
        PeerTokenError::InvalidMint
    );
    msg!(" Mint consistency validated");


    // Double time Initialization Check (Treasury Wallet)
    require_eq!(
        config.wallets.treasury_wallet.key(),
        Pubkey::default(),
        PeerTokenError::AlreadyInitialized
    );

     // Double time Initialization Check (Fee Wallet)
     require_eq!(
        config.wallets.fee_wallet.key(),
        Pubkey::default(),
        PeerTokenError::AlreadyInitialized
    );
    
    // Validate token accounts have correct mint
    msg!(" Validating token accounts have correct mint...");
    require_eq!(
        ctx.accounts.treasury_ata.mint,
        mint_pubkey,
        PeerTokenError::InvalidMint
    );
    require_eq!(
        ctx.accounts.fee_ata.mint,
        mint_pubkey,
        PeerTokenError::InvalidMint
    );
    msg!(" System token accounts validated");

    // Store system wallets in config (Previously Its default)
    msg!(" Storing system wallets in config...");
    config.wallets.treasury_wallet = ctx.accounts.treasury_wallet.key();
    config.wallets.fee_wallet = ctx.accounts.fee_wallet.key();
    
    // logging
    msg!(" SYSTEM WALLETS (stored in config):");
    msg!("  Treasury wallet: {}", ctx.accounts.treasury_wallet.key());
    msg!("  Fee wallet: {}", ctx.accounts.fee_wallet.key());
    msg!("");
    msg!(" SYSTEM TOKEN ACCOUNTS (ATAs created):");
    msg!("   Treasury ATA: {}", ctx.accounts.treasury_ata.key());
    msg!("   Fee ATA: {}", ctx.accounts.fee_ata.key());
    msg!("   Continue with InitializeSecurityWallets for LP and minting wallets");
    
    Ok(())
}