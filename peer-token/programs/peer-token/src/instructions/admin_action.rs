use anchor_lang::prelude::*;
use anchor_lang::solana_program::rent::{DEFAULT_EXEMPTION_THRESHOLD, DEFAULT_LAMPORTS_PER_BYTE_YEAR};
use anchor_spl::token_2022::{MintTo, MintToChecked};

use anchor_spl::token_interface::{Mint, TokenInterface, TokenAccount};
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_2022::{
    token_metadata_initialize, TokenMetadataInitialize, TokenMetadata};

use anchor_spl::system_program::{transfer, Transfer};

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct TokenMetadataArgs {
    pub name: String,
    pub symbol: String,
    pub uri: String,
}


// These are the accounts for the admin to interact with the program
#[derive(Accounts)]
pub struct AdminAction<'info> {

    //Signer as admin
    #[account(mut)]
    pub admin_wallet: Signer<'info>,
    
    #[account(mut)]
    pub mint_wallet: AccountInfo<'info>,
   
    //Storage wallet to store the tokens
   #[account(mut)]
   pub storage_wallet: AccountInfo<'info>,

    //LP wallet to store the tokens
    #[account(mut)]
    pub lp_wallet: AccountInfo<'info>,

   //Peer wallet to store the fees
   #[account(mut)]
   pub peer_wallet: AccountInfo<'info>,


// Mint Account Initialization 
    #[account(
        init,
        payer = admin_wallet,
        mint::decimals = 9,  
        mint::authority = admin_wallet.key(),
        // mint::freeze_authority = peer_authority.key(),
        seeds = [b"peer-token"],
        bump,
    )]
    pub peer_mint: InterfaceAccount<'info, Mint>,

// All Token Accounts Initialization 
    #[account(
        init,
        payer = admin_wallet,
        associated_token::mint = peer_mint,
        associated_token::token_program = token_program,
        associated_token::authority = admin_wallet,
    )]
    pub admin_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init,
        payer = admin_wallet,
        associated_token::mint = peer_mint,
        associated_token::token_program = token_program,
        associated_token::authority = mint_wallet,
    )]
    pub mint_token_account: InterfaceAccount<'info, TokenAccount>,
    

    #[account(
        init,
        payer = admin_wallet,
        associated_token::mint = peer_mint,
        associated_token::token_program = token_program,
        associated_token::authority = storage_wallet,
    )]
    pub storage_token_account: InterfaceAccount<'info, TokenAccount>,


    #[account(
        init,
        payer = admin_wallet,
        associated_token::mint = peer_mint,
        associated_token::token_program = token_program,
        associated_token::authority = lp_wallet,
    )]
    pub lp_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init,
        payer = admin_wallet,
        associated_token::mint = peer_mint,
        associated_token::token_program = token_program,
        associated_token::authority = peer_wallet,
    )]
    pub peer_token_account: InterfaceAccount<'info, TokenAccount>,


    pub associated_token_program: Program<'info, AssociatedToken>,
    

    pub system_program: Program<'info, System>,
    
    /// Spl Token program interface (works with Token-2022)
    pub token_program: Interface<'info, TokenInterface>,
    
    
} 

pub fn handler(
     ctx: Context<AdminAction>,
     args: TokenMetadataArgs,
) -> Result<()> {
     
   let TokenMetadataArgs {name,symbol,uri} = args;


   let token_metadata = TokenMetadata {
    name: name.clone(),
    symbol: symbol.clone(),
    uri: uri.clone(),
    ..Default::default()
};
 // Add 4 extra bytes for size of MetadataExtension (2 bytes for type, 2 bytes for length)
 let data_len = 4 + token_metadata.get_packed_len()?;

 // Calculate lamports required for the additional metadata
 let lamports =
     data_len as u64 * DEFAULT_LAMPORTS_PER_BYTE_YEAR * DEFAULT_EXEMPTION_THRESHOLD as u64;
// Transfer additional lamports to mint account for metadata
transfer(
    CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        Transfer {
            from: ctx.accounts.admin_wallet.to_account_info(),
            to: ctx.accounts.peer_mint.to_account_info(),
        },
    ),
    lamports,
)?;

   token_metadata_initialize(
    CpiContext::new_with_signer(
        ctx.accounts.mint_wallet.to_account_info(),
        TokenMetadataInitialize {
            token_program_id: ctx.accounts.token_program.to_account_info(),
            mint: ctx.accounts.peer_mint.to_account_info(),
            metadata: ctx.accounts.peer_mint.to_account_info(),
            mint_authority: ctx.accounts.admin_wallet.to_account_info(),
            update_authority: ctx.accounts.admin_wallet.to_account_info(),
        },
        ctx.accounts.admin_wallet.to_account_info(),
    ),
    name,
    symbol,
    uri,
)?;



pub fn get_current_day() -> Result<u64> {
    let clock = Clock::get()?;
    let current_timestamp = clock.unix_timestamp as u64;
    // Convert timestamp to day number (86400 seconds = 1 day)
    Ok(current_timestamp / 86400)
}


pub fn mint_to_wallet(ctx: Context<AdminAction>, amount: u64) -> Result<()> {



    let mint_to_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        MintTo {
            mint: ctx.accounts.peer_mint.to_account_info(),
            to: ctx.accounts.mint_token_account.to_account_info(),
            authority: ctx.accounts.admin_wallet.to_account_info(),
        }
    );
 
    token_interface::mint_to(mint_to_ctx, amount)?;
    Ok(())
}
Ok(())
}