use anchor_lang::prelude::*;

declare_id!("7tUBeYarZfa7mkhZeNoEanWyuUaZhStmbk89rXKj4ck9");

#[program]
pub mod peer_token {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
