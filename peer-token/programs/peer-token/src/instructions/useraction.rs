use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};




#[derive(Accounts)]
pub struct UserAction<'info> {
    #[account(mut)]
    pub user_wallet: AccountInfo<'info>,

    #[account(mut)]
    pub peer_mint: AccountInfo<'info>,


}

#[derive(Accounts)]
pub struct TransferToken<'info> {
    #[account(mut)]
    pub user_wallet: AccountInfo<'info>,

    #[account(mut)]
    pub peer_mint: AccountInfo<'info>,

    #[account(mut)]
    pub recipient_wallet: AccountInfo<'info>,

    #[account(mut)]
    pub user_token_account: AccountInfo<'info>,
    
    
}