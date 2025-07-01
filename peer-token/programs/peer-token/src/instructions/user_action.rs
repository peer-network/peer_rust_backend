use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount , Wallet};
use anchor_spl::token_interface::TokenInterface;


// #[derive(Accounts)]
// pub struct UserAction<'info> {
//     #[account(mut)]
//     pub user: Signer<'info>,
// }




// The Following are the instructions for the user to interact with the program

pub fn user_handler(ctx: Context<UserAction>) -> Result<()> {
    Ok(())
}


#[derive(Accounts)]
pub struct UserAction<'info> {
    #[account(mut)]
    pub peer_storage: Signer<'info>,

    pub user_wallet: AccountInfo<'info>,

    pub peer_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub peer_token_account: InterfaceAccount<'info, TokenAccount>,

}

#[derive(Accounts)]
pub struct TransferTokens<'info> {


    pub peer_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub sender_wallet: Signer<'info>,

    #[account(mut)]
    pub recipient_wallet: Account<'info, Wallet>,

    #[account(mut)]
    pub sender_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = peer_mint,
        associated_token::authority = sender_wallet,
        associated_token::token_program = token_program,
    )]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,


    
    pub token_program: Interface<'info, TokenInterface>,
    
    
}

#[derive(Accounts)]
pub struct CreateUserTokenAccount<'info> { 
    #[account(mut)]
    pub peer_storage: Signer<'info>,

    #[account(mut)]
    pub user_wallet: AccountInfo<'info>,
    
    #[account(mut)]
    pub peer_mint: AccountInfo<'info>,



    
}


