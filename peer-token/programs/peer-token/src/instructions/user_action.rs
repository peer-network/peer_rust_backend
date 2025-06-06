use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount};
use anchor_spl::associated_token::a

#[derive(Accounts)]
pub struct UserAction<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
}




// The Following are the instructions for the user to interact with the program

pub fn user_action(ctx: Context<UserAction>) -> Result<()> {
    Ok(())
}


#[derive(Accounts)]
pub struct UserActionArgs<'info> {
    #[account(mut)]
    pub peer_storage: Signer<'info>,

    pub user_wallet: AccountInfo<'info>,

    pub peer_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub peer_token_account: InterfaceAccount<'info, TokenAccount>,
}


