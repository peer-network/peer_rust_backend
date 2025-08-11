use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};
use anchor_spl::associated_token::AssociatedToken;
use crate::state::*;
use crate::constants::*;
use crate::errors::PeerTokenError;



#[derive(Accounts)]
pub struct InitializeSecurityWallets<'info> {
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
    

    // LP WALLET - Liquidity Pool (SECURE)
    // This wallet Connects to DEX (ORCA)
    #[account(
        init,
        payer = peer_admin,
        associated_token::mint = peer_mint,
        associated_token::authority = lp_wallet,
        associated_token::token_program = token_program
    )]
    pub lp_ata: InterfaceAccount<'info, TokenAccount>,
    
    /// CHECK: LP wallet authority (DEX liquidity management - SECURE)
    /// REQUIREMENTS:
    /// - Hardware wallet (Mostly), Multisig wallet preferred
    /// - Controls  liquidity
    pub lp_wallet: UncheckedAccount<'info>,
    


    
    /// MINTING ATA - ULTRA SECURE TOKEN CUSTODY
    /// This wallet controls token supply
    /// Must use hardware wallet or multisig for security
    #[account(
        init,
        payer = peer_admin,
        associated_token::mint = peer_mint,
        associated_token::authority = minting_wallet,
        associated_token::token_program = token_program
    )]
    pub minting_ata: InterfaceAccount<'info, TokenAccount>,
    
    /// CHECK: MINTING WALLET AUTHORITY -  SECURE
    ///  REQUIREMENTS:
    /// - Hardware wallet (Mostly), Multisig wallet preferred
    pub minting_wallet: UncheckedAccount<'info>,
    
    
    
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}



pub fn security_handler(ctx: Context<InitializeSecurityWallets>) -> Result<()> {
    msg!(" Initializing security wallets (LP & Minting) for Peer Token...");
    
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


    // Double time Initialization Check (lp Wallet)
    require_eq!(
        config.wallets.lp_wallet.key(),
        Pubkey::default(),
        PeerTokenError::AlreadyInitialized
    );

     // Double time Initialization Check (Minting Wallet)
     require_eq!(
        config.wallets.minting_wallet.key(),
        Pubkey::default(),
        PeerTokenError::AlreadyInitialized
    );
    
    // Validate token accounts have correct mint
    msg!(" Validating token accounts have correct mint...");
    require_eq!(
        ctx.accounts.lp_ata.mint,
        mint_pubkey,
        PeerTokenError::InvalidMint
    );
    require_eq!(
        ctx.accounts.minting_ata.mint,
        mint_pubkey,
        PeerTokenError::InvalidMint
    );
    msg!(" Security token accounts validated");

    // Store security wallets in config (Previously Its default)
    msg!(" Storing security wallets in config...");
    config.wallets.lp_wallet = ctx.accounts.lp_wallet.key();
    config.wallets.minting_wallet = ctx.accounts.minting_wallet.key();
    
    // logging
    msg!(" SECURITY WALLETS (stored in config):");
    msg!(" LP wallet: {}", ctx.accounts.lp_wallet.key());
    msg!(" Minting wallet: {}", ctx.accounts.minting_wallet.key());
    msg!("");
    msg!(" SECURITY TOKEN ACCOUNTS (ATAs created):");
    msg!(" LP ATA: {}", ctx.accounts.lp_ata.key());
    msg!(" Minting ATA: {}", ctx.accounts.minting_ata.key());
    msg!("");
    msg!(" ALL WALLETS FULLY INITIALIZED!");
    msg!(" COMPLETE WALLET INFRASTRUCTURE:");
    msg!("   Treasury: {}", config.wallets.treasury_wallet);
    msg!("   Fee: {}", config.wallets.fee_wallet);
    msg!("   LP: {}", config.wallets.lp_wallet);
    msg!("   Minting: {}", config.wallets.minting_wallet);
    
    Ok(())
}
