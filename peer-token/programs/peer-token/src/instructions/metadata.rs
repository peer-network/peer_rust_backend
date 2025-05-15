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
    // Cross Program Invocation (CPI)
    // Invoking the create_metadata_account_v3 instruction on the token metadata program
    let mint_seeds = &[b"peer-token".as_ref(), &[ctx.bumps.peer_mint]];
    let mint_signer = &[&mint_seeds[..]];

    // Use the CreateV1CpiBuilder for creating token metadata
    CreateV1CpiBuilder::new(&ctx.accounts.token_metadata_program)
        .metadata(&ctx.accounts.metadata_account)
        .mint(&ctx.accounts.peer_mint.to_account_info(), false) // Don't require mint to be signer
        .authority(&ctx.accounts.peer_authority)
        .payer(&ctx.accounts.peer_authority)
        .update_authority(&ctx.accounts.peer_authority, true)
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
    /// The fee peer_authority and mint authority
    #[account(mut)]
    pub peer_authority: Signer<'info>, 
    
    #[account(
        mut,
        seeds=[b"peer-token"],
        bump,
        constraint = peer_mint.mint_authority.unwrap() == peer_authority.key(),
        constraint = peer_mint.to_account_info().owner == &token_program.key(),
        constraint = peer_mint.decimals > 0
    )]
    pub peer_mint: InterfaceAccount<'info, Mint>,
    
    /// The Metaplex metadata account (PDA)
    /// CHECK: Validate address by deriving PDA
    #[account(
        mut,
        seeds = [b"metadata", token_metadata_program.key().as_ref(), peer_mint.key().as_ref()],
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
    
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub sysvar_instructions: UncheckedAccount<'info>,

    pub rent: Sysvar<'info, Rent>,
} 