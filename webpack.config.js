const path = require('path');

module.exports = {
  entry: {
    game: './src/public/js/game.ts',
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: 'tsconfig.client.json'
          }
        },
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'src/public/dist'),
  },
  mode: 'development',
}; 