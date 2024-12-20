import dotenv from "dotenv";
import path from "path";
import webpack from "webpack";
import MiniCssExtractPlugin from "mini-css-extract-plugin";

dotenv.config();

const mode = process.env.NODE_ENV === "production" ? "production" : "development";

const config: webpack.Configuration = {
  entry: {
    game: path.join(process.cwd(), "src", "public", "js", "game.ts"),
    lobby: path.join(process.cwd(), "src", "public", "js", "lobby.ts"),
    styles: [
      path.join(process.cwd(), "src", "public", "css", "variables.css"),
      path.join(process.cwd(), "src", "public", "css", "main.css"),
      path.join(process.cwd(), "src", "public", "css", "auth.css"),
      path.join(process.cwd(), "src", "public", "css", "lobby.css"),
      path.join(process.cwd(), "src", "public", "css", "board.css"),
      path.join(process.cwd(), "src", "public", "css", "game.css")
    ]
  },
  mode,
  output: {
    path: path.join(process.cwd(), "public", "dist"),
    filename: "js/[name].bundle.js",
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: "css-loader",
            options: {
              url: false,
              import: true
            }
          }
        ]
      }
    ],
  },
  resolve: {
    extensions: [".ts", ".js", ".css"],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: "css/[name].css"
    })
  ]
};

export default config;