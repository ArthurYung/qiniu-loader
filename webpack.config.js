const myPlugin = require("./bin");
module.exports = {
  entry: "./index.js",
  mode: "production",
  output: {
    filename: "bundle.js"
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
              limit: 8192,
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
  plugins: [
    new myPlugin({
      host: "http://cdn.toofook.com",
      dirname: "myBolot",
      ak: "imM5KIryDmH88QQ0ePHd5OQNX8aSqlUBKHDXRlvL",
      sk: "NF-wmljgIP8dlgNOaWJ3x1Tg40uNev6IDeVLhR8p",
      bk: "brucecdn",
    })
  ]
};
