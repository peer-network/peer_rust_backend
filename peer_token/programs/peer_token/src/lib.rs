use anchor_lang::prelude::*;

declare_id!("HHTL86egG3w6wiSxRmXrphLGcv42S5WsrRSfbfQem35H");

#[program]
pub mod peer_token {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
