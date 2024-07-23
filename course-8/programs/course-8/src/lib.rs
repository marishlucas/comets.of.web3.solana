use anchor_lang::prelude::*;

declare_id!("AeDwWcyUSZofEbYjBcN8XrVze27geUVyJypnkhHY1duk");

pub const ANCHOR_DISCRIMINATOR_SIZE: usize = 8;

// A 'mod' is a Rust module. But the #[program] makes it into a Solana program!
#[program]
pub mod favorites {
    use super::*;
    // Our instruction handler! It sets the user's favorite number and color
    pub fn set_favorites(
        context: Context<SetFavorites>,
        number: u64,
        color: String,
        hobbies: Vec<String>,
    ) -> Result<()> {
        let user_public_key = context.accounts.user.key();
        msg!("Greetings from {}", context.program_id);
        msg!("User {user_public_key}'s favorite number is {number}, favorite color is: {color}",);
        msg!("User's hobbies are: {:?}", hobbies);
        context.accounts.favorites.set_inner(Favorites {
            number,
            color,
            hobbies,
        });
        Ok(())
    }
    // We can also add a get_favorites instruction handler to return the user's favorite number and color
}

#[account]
#[derive(InitSpace)]
pub struct Favorites {
    pub number: u64,
    #[max_len(50)]
    pub color: String,
    #[max_len(5, 50)]
    pub hobbies: Vec<String>,
}

#[derive(Accounts)]
pub struct SetFavorites<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        init,
        payer = user,
        space = ANCHOR_DISCRIMINATOR_SIZE + Favorites::INIT_SPACE,
        seeds=[b"favorites", user.key().as_ref()],
        bump)]
    pub favorites: Account<'info, Favorites>,
    pub system_program: Program<'info, System>,
}
