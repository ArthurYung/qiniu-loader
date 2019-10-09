const myPlugin = require("./bin");
const path = require("path");
module.exports = {
  entry: "./index.js",
  mode: "production",
  output: {
    filename: "bundle.js"
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/"),
      Utilities: path.resolve(__dirname, "src/utilities/"),
      Templates: path.resolve(__dirname, "src/templates/")
    }
  },
  module: {
    rules: [
      {
        test: /\.(png|jpg)$/,
        use: [
          // {loader: myPlugin.loader},
          {
            loader: "url-loader",
            options: {
              limit: 8192
              // name: 'images/[name]_[hash:7].[ext]'
            }
          }
        ]
      },
      {
        test: /\.(css)$/,
        use: [
          {
            loader: "style-loader"
          },
          {
            loader: "css-loader"
          }
        ]
      }
    ]
  },
  plugins: [new myPlugin({})]
};
