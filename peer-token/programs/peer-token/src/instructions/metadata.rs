use {
    anchor_lang::prelude::*,
    anchor_spl::{
        metadata::{
            create_metadata_accounts_v3, mpl_token_metadata::types::{DataV2, TokenStandard},
            CreateMetadataAccountsV3, Metadata,
        },
        token_interface::{Mint, TokenInterface},
    },
};

pub fn handler(
    ctx: Context<CreateMetadataArgs>,
    token_decimals: u8,
    token_name: String,
    token_symbol: String,
    token_uri: String,
) -> Result<()> {
    msg!("Creating metadata for FUNGIBLE Token-2022 token: {}", token_name);
    msg!("Metadata account address: {}", &ctx.accounts.metadata_account.key());
    msg!("Token decimals: {}", token_decimals);

    // Cross Program Invocation (CPI)
    // Invoking the create_metadata_account_v3 instruction on the token metadata program
    create_metadata_accounts_v3(
        CpiContext::new(
            ctx.accounts.token_metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                metadata: ctx.accounts.metadata_account.to_account_info(),
                mint: ctx.accounts.mint_account.to_account_info(),
                mint_authority: ctx.accounts.payer.to_account_info(),
                update_authority: ctx.accounts.payer.to_account_info(),
                payer: ctx.accounts.payer.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
        ),
        DataV2 {
            name: token_name,
            symbol: token_symbol,
            uri: token_uri,
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        },
        false, // Is mutable (false for fungible tokens)
        true,  // Update authority is signer
        None,  // Collection details (None for fungible tokens)
    )?;

    msg!("Metaplex metadata created successfully for FUNGIBLE Token-2022 token");
    Ok(())
}

/// Arguments for creating Metaplex metadata for a Token-2022 fungible token
#[derive(Accounts)]
#[instruction(token_decimals: u8, token_name: String, token_symbol: String, token_uri: String)]
pub struct CreateMetadataArgs<'info> {
    /// The fee payer and mint authority
    #[account(mut)]
    pub payer: Signer<'info>,
    
    /// Existing Token-2022 mint to attach metadata to
    /// Must have decimals > 0 to be treated as a fungible token
    #[account(
        mut,
        constraint = mint_account.mint_authority.unwrap() == payer.key(),
        constraint = mint_account.to_account_info().owner == &token_program.key(),
        constraint = mint_account.decimals > 0
    )]
    pub mint_account: InterfaceAccount<'info, Mint>,
    
    /// The Metaplex metadata account (PDA)
    /// CHECK: Validate address by deriving PDA
    #[account(
        mut,
        seeds = [b"metadata", token_metadata_program.key().as_ref(), mint_account.key().as_ref()],
        bump,
        seeds::program = token_metadata_program.key(),
    )]
    pub metadata_account: UncheckedAccount<'info>,
    
    /// Metaplex Token Metadata program
    pub token_metadata_program: Program<'info, Metadata>,
    
    /// Token program interface (Token-2022)
    pub token_program: Interface<'info, TokenInterface>,
    
    /// System program
    pub system_program: Program<'info, System>,
    
    /// Rent sysvar
    pub rent: Sysvar<'info, Rent>,
} 