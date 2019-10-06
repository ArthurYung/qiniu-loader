const loaderUtils = require("loader-utils");
const setLocalAsset = require("./qiniu").setLocalAsset;
const fs = require("fs");

module.exports = function(source) {
  const options = loaderUtils.getOptions(this) || {};
  // const hash = loaderUtils.getHashDigest(source);

  const requestUrl = this._module.userRequest;
  const fileInfo = fs.statSync(requestUrl);
  const requestBuffer = fs.readFileSync(requestUrl)

  // 因为在此loader执行之前source会被用户自行配置的loader处理
  // 所以采取监听源文件的hash值来进行命名，便于上传时与云端文件hash值对比
  const hash = loaderUtils.getHashDigest(requestBuffer)

  const fileName = loaderUtils.interpolateName(this, "[name]_" + hash + ".[ext]", {
    content: source
  });

  const uploadKey = `${options.dirname}/${fileName}`
  const uploadUrl = `${options.host}/${uploadKey}`
  
  const result = {
    asset: {
      uploadKey,
      hash,
      request: requestUrl,
      emit: fileInfo.size > options.limit ? true : false
    },
    source:
      fileInfo.size > options.limit ? `module.exports = '${uploadUrl}'` : source
  };

  setLocalAsset(requestUrl, result.asset);

  return result.source;
};
