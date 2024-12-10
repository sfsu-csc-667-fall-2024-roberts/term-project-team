export const REGISTER_SQL = `
  INSERT INTO users (username, hashed_password)
  VALUES ($1, $2)
  RETURNING id, username
`;

export const FIND_BY_USERNAME_SQL = `
  SELECT id, username, hashed_password
  FROM users
  WHERE username = $1
`;
