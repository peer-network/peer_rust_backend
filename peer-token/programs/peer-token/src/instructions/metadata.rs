use {
    anchor_lang::prelude::*,
    anchor_spl::{
        metadata::{
            mpl_token_metadata::{
                instructions::CreateV1CpiBuilder,
                types::{TokenStandard, PrintSupply},
            },
            Metadata,
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

    // Use the mint_account as a signer using a PDA with seeds
    // This is required by the Metaplex metadata API
    let mint_seeds = &[b"peer-token".as_ref(), &[ctx.bumps.mint_account]];
    let mint_signer = &[&mint_seeds[..]];

    // Use the CreateV1CpiBuilder for creating token metadata
    CreateV1CpiBuilder::new(&ctx.accounts.token_metadata_program)
        .metadata(&ctx.accounts.metadata_account)
        .mint(&ctx.accounts.mint_account.to_account_info(), false) // Don't require mint to be signer
        .authority(&ctx.accounts.payer)
        .payer(&ctx.accounts.payer)
        .update_authority(&ctx.accounts.payer, true)
        .system_program(&ctx.accounts.system_program)
        .sysvar_instructions(&ctx.accounts.sysvar_instructions)
        .spl_token_program(&ctx.accounts.token_program.to_account_info())
        .token_standard(TokenStandard::Fungible)
        .seller_fee_basis_points(0)
        .print_supply(PrintSupply::Unlimited)
        .name(token_name)
        .symbol(token_symbol)
        .uri(token_uri)
        .decimals(token_decimals)
        .invoke_signed(mint_signer)?; // Use invoke_signed instead of invoke

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
        seeds = [b"peer-token"],
        bump,
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
    
    /// Sysvar Instructions 
    /// CHECK: Used by the Metaplex program
    pub sysvar_instructions: UncheckedAccount<'info>,
    
    /// Rent sysvar
    pub rent: Sysvar<'info, Rent>,
} 