use anchor_lang::prelude::*;

declare_id!("FQahsxqzzkvVQDC7W7kA16cUALfgZ9M2UUH9utV4V9YL");

#[program]
pub mod peer_token {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
