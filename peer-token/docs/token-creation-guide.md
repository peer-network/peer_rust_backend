# Token Creation Guide for Beginners

This guide explains how to create and manage tokens on Solana using the SPL Token-2022 standard. It's designed for people who are new to Solana programming and may not be familiar with concepts like accounts.

## Understanding Solana Accounts

Before diving into token creation, it's important to understand a few core Solana concepts:

1. **Accounts**: On Solana, all data is stored in accounts. An account is like a file in a file system that can hold data and SOL (Solana's native currency). Every account has an address (a public key).

2. **Program Accounts**: Special accounts that contain executable code. Our token program is one example.

3. **Data Accounts**: Accounts that store data but don't contain executable code. For tokens, these include mint accounts and token accounts.

4. **Signer**: An account that has signed a transaction, proving ownership of that account.

5. **PDA (Program Derived Address)**: An account whose address is derived from a program ID and optional seeds. This allows programs to control specific accounts.

## Token-2022 Overview

SPL Token-2022 is Solana's newest token standard, an upgraded version of the original SPL Token program. It offers additional features while maintaining compatibility with existing tools.

## Step 1: Creating a Token Mint

A token mint is the account that defines a token and has the authority to create (mint) new tokens.

### Required Accounts for Token Creation:

1. **Signer Account**: The wallet initiating the transaction. This account:
   - Pays the transaction fees
   - Becomes the mint authority (can create new tokens)
   - Must sign the transaction

2. **Mint Account**: The account that will be created to represent your token. This account:
   - Stores information about your token (supply, decimals, etc.)
   - Is a PDA derived from your wallet and token name
   - Has a unique address that identifies your token

3. **System Program**: A built-in Solana program needed to create new accounts

4. **Token Program**: The Token-2022 program that manages token operations

### Understanding the Mint Instruction:

```rust
#[derive(Accounts)]
#[instruction(token_name: String)]
pub struct MintTokenArgs<'info> {
    /// The fee payer and mint authority
    #[account(mut)]
    pub signer: Signer<'info>,

    /// The token mint account to be created
    #[account(
        init,                                  // Initialize a new account
        payer = signer,                        // The signer pays for account creation
        mint::decimals = 9,                    // Set 9 decimal places for the token
        mint::authority = signer.key(),        // The signer becomes the mint authority
        seeds = [b"token-2022-token", signer.key().as_ref(), token_name.as_bytes()],  // PDA seeds
        bump,                                  // Add bump seed for PDA derivation
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    /// System program
    pub system_program: Program<'info, System>,
    
    /// Token program interface (works with Token-2022)
    pub token_program: Interface<'info, TokenInterface>,
}
```

### What Happens During Token Creation:

1. When you call the `create_token` instruction, our program creates a new account to represent your token (the mint account).

2. This mint account has:
   - 9 decimal places (meaning your token can be divided into billionths)
   - You (the signer) as the mint authority, giving you the power to create new tokens
   - A unique address derived from your wallet and the token name

3. The transaction gets processed, logs are created to confirm the new token mint, and the mint account is now stored on the Solana blockchain.

## Step 2: Creating Token Metadata

After creating a token mint, you'll want to add metadata to make your token more recognizable and usable.

### Required Accounts for Metadata Creation:

1. **Payer Account**: Your wallet that pays for the transaction
2. **Mint Account**: The existing token mint you created previously
3. **Metadata Account**: A PDA derived from the Metaplex program and your mint
4. **Token Metadata Program**: The Metaplex program that manages token metadata
5. **Token Program**: The Token-2022 program
6. **System Program**: Needed to create the metadata account
7. **Rent Sysvar**: Provides information about rent exemption

### Understanding the Metadata Instruction:

The `create_token_metadata` instruction adds important details to your token:
- Name: The full name of your token (e.g., "Peer Token")
- Symbol: A short ticker symbol (e.g., "PEER")
- URI: A link to additional metadata, usually hosted off-chain
- Decimals: The number of decimal places for your token

This makes your token discoverable in wallets and marketplaces.

## Step 3: Creating Token Accounts

After creating a token, users need accounts to hold that token. There are two types:

### Standard Token Accounts:
- Custom accounts that your program creates at a specific PDA
- Useful for program-controlled token storage

### Associated Token Accounts (ATAs):
- Standard accounts that follow a convention making them easily discoverable
- The recommended way for users to receive tokens
- Automatically derived from a user's wallet address and the token mint

### Understanding Associated Token Account Creation:

```rust
#[derive(Accounts)]
pub struct CreateTokenAtaArgs<'info> {
    /// The fee payer and account owner (can be company wallet or user wallet)
    #[account(mut)]
    pub wallet_owner: Signer<'info>,
    
    /// The token mint this ATA will be associated with
    pub mint: InterfaceAccount<'info, Mint>,
    
    /// The associated token account to be created
    #[account(
        init,
        associated_token::mint = mint,
        payer = wallet_owner,
        associated_token::authority = wallet_owner,
    )]
    pub token_account: InterfaceAccount<'info, TokenAccount>,
    
    /// System program
    pub system_program: Program<'info, System>,
    
    /// Token program interface (works with Token-2022)
    pub token_program: Interface<'info, TokenInterface>,
    
    /// Associated token program for creating ATAs
    pub associated_token_program: Program<'info, AssociatedToken>,
}
```

### What Happens When Creating an ATA:

1. The instruction checks if the wallet already has an ATA for this token
2. If not, it creates a new token account at the standard ATA address
3. This account is owned by the wallet_owner and can only hold tokens of the specified mint
4. The account follows a standard derivation, so any program can find it given just the wallet address and mint

## Step 4: Minting Tokens

Once you have a token mint and token accounts, you can mint (create) new tokens.

### Required Accounts for Minting:

1. **Signer**: Must be the mint authority
2. **Mint Account**: The token mint to create tokens from
3. **Receiver Account**: The token account that will receive the new tokens
4. **Token Program**: The Token-2022 program

### Understanding the Mint-To Instruction:

```rust
#[derive(Accounts)]
pub struct MintToArgs<'info> {
    /// The mint authority
    #[account(mut)]
    pub signer: Signer<'info>,
    
    /// The token mint
    #[account(
        mut,
        constraint = mint.mint_authority.unwrap() == signer.key()
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    
    /// The token account receiving the newly minted tokens
    #[account(
        mut,
        constraint = receiver.mint == mint.key(),
        constraint = receiver.owner != Pubkey::default()
    )]
    pub receiver: InterfaceAccount<'info, TokenAccount>,
    
    /// Token program interface
    pub token_program: Interface<'info, TokenInterface>,
}
```

### What Happens During Minting:

1. The program checks that you're the authorized mint authority
2. It verifies the receiver account is valid and associated with your token
3. It creates new tokens and adds them to the receiver's balance
4. The total supply of your token increases

## Step 5: Transferring Tokens

Finally, tokens can be transferred between accounts.

### Required Accounts for Transfer:

1. **Signer**: The owner of the source token account
2. **From Account**: The token account to transfer from
3. **To Wallet**: The destination wallet
4. **To ATA**: The destination's Associated Token Account (can be created automatically)
5. **Mint**: The token mint
6. **Token Program**: The Token-2022 program
7. **System Program**: Needed if creating a new destination ATA
8. **Associated Token Program**: Needed if creating a new destination ATA

### Understanding the Transfer Instruction:

The transfer instruction moves tokens from one account to another, and can automatically create the destination ATA if it doesn't exist.

## Typical User Flow

1. Someone creates a token mint (the company/project)
2. They add metadata to make the token recognizable
3. They create an ATA for their own wallet
4. They mint tokens to their ATA
5. Users create ATAs for the token
6. Tokens are transferred between ATAs

## Company vs User Accounts

Both companies and users use the same instructions but typically:

- **Companies**: Create the token mint, manage metadata, mint new tokens
- **Users**: Create ATAs, receive and transfer tokens

## Best Practices

1. Always use ATAs when possible - they're the standard way to receive tokens
2. Keep track of your mint authority - losing it means losing control of token supply
3. Set appropriate decimals - 9 is standard for fungible tokens
4. Add complete metadata to improve user experience 