use anchor_lang::prelude::*;

declare_id!("2MXDxV77pdvmGfUq8BHsHZ7usiFAJpMVZ5j8LJthNtSz");

#[program]
pub mod course_7 {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
