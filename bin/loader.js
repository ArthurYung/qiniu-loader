const loaderUtils = require("loader-utils");
const setLocalAsset = require("./qiniu").setLocalAsset;
const fs = require("fs");

module.exports = function(source) {
  const options = loaderUtils.getOptions(this) || {};
  const hash = loaderUtils.getHashDigest(source);
  const requestUrl = this._module.userRequest;
  const fileInfo = fs.statSync(requestUrl);
  const fileName = loaderUtils.interpolateName(this, "[name].[hash].[ext]", {
    content: source
  });

  const uploadKey = [options.host, options.dirname, fileName].join("/");

  const result = {
    asset: {
      uploadKey,
      hash,
      request: requestUrl,
      emit: fileInfo.size > options.limit ? true : false
    },
    source:
      fileInfo.size > options.limit ? `module.exports = '${uploadKey}'` : source
  };

  setLocalAsset(requestUrl, result.asset);

  return result.source;
};
