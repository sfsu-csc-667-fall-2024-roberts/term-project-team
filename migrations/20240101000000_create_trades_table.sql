-- Up Migration
CREATE TABLE trades (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    from_player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    to_player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    offered_properties JSONB NOT NULL DEFAULT '[]',
    requested_properties JSONB NOT NULL DEFAULT '[]',
    offered_money INTEGER NOT NULL DEFAULT 0,
    requested_money INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(10) NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX trades_game_id_idx ON trades(game_id);
CREATE INDEX trades_from_player_id_idx ON trades(from_player_id);
CREATE INDEX trades_to_player_id_idx ON trades(to_player_id);
CREATE INDEX trades_status_idx ON trades(status);

-- Down Migration
DROP TABLE IF EXISTS trades; 