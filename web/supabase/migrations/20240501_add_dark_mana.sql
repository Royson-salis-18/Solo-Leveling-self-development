-- Add Dark Mana column to user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS dark_mana INTEGER DEFAULT 0;

-- Comment for documentation
COMMENT ON COLUMN user_profiles.dark_mana IS 'Accumulated penalty points for failing or postponing tasks.';
