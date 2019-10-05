const path = require("path");
const Qiniu = require("./qiniu");
const loaderPath = path.resolve(__dirname, "loader.js");

const unshiftLoader = (moduleContext, options = {}) => {
  if (!moduleContext.loaders) return;
  moduleContext.loaders = [{ loader: loaderPath, options }].concat(
    moduleContext.loaders
  );
};

const defaultOptions = {
  dirName: "my-qiniu",
  limit: 100,
  inclouds: ".(jpg|png|gif|svg|webp)$",
  maxFile: 100
};

class MyExampleWebpackPlugin {
  constructor(options = {}) {
    this.uploadOption = Object.assign({}, defaultOptions, options);
    this.applyCompilerCallback = this.applyCompilerCallback.bind(this);
    this.comilationTapCallback = this.comilationTapCallback.bind(this);
    this.getModulesOutputPath = this.getModulesOutputPath.bind(this);
    this.startUploadAsstes = this.startUploadAsstes.bind(this);

    this.qiniu = new Qiniu.createQiNiu(this.uploadOption);
  }
  // 将 `apply` 定义为其原型方法，此方法以 compiler 作为参数
  apply(compiler) {
    // 指定要附加到的事件钩子函数
    if (compiler.hooks) {
      compiler.hooks.thisCompilation.tap(
        "QiniuAutoPlugin",
        this.applyCompilerCallback
      );
      compiler.hooks.done.tap("QiniuAutoPlugin", this.startUploadAsstes);
    } else {
      compiler.plugin("this-compilation", this.applyCompilerCallback);
    }
  }
  applyCompilerCallback(compilation) {
    if (compilation.hooks) {
      compilation.hooks.normalModuleLoader.tap(
        "QiniuAutoPlugin",
        this.comilationTapCallback
      );
      compilation.hooks.moduleAsset.tap(
        "QiniuAutoPlugined",
        this.getModulesOutputPath
      );
    } else {
      compilation.plugin("normal-module-loader", this.comilationTapCallback);
      compilation.plugin("module-asset", this.getModulesOutputPath);
    }
  }
  comilationTapCallback(loaderContext, moduleContext) {
    const includsReg = new RegExp(this.uploadOption.inclouds);
    if (includsReg.test(moduleContext.rawRequest)) {
      unshiftLoader(moduleContext, this.uploadOption);
    }
  }
  getModulesOutputPath(moduleContext, fileName) {
    console.log(fileName);
    Qiniu.setLocalAsset(moduleContext.userRequest, {
      outputFile: fileName
    });
  }
  startUploadAsstes(c) {
    // this.qiniu.uploadStart();
  }
}

module.exports = MyExampleWebpackPlugin;
