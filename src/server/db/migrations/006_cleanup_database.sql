-- Clean up all existing data
DO $$ 
BEGIN
    -- Delete all existing data
    DELETE FROM players;
    DELETE FROM games;
    DELETE FROM users;
    
    -- Reset sequences
    ALTER SEQUENCE players_id_seq RESTART WITH 1;
    ALTER SEQUENCE games_id_seq RESTART WITH 1;
    ALTER SEQUENCE users_id_seq RESTART WITH 1;
END $$; 