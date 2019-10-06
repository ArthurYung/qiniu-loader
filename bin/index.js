const path = require("path");
const Qiniu = require("./qiniu");
const loaderPath = path.resolve(__dirname, "loader.js");

// 默认配置
const defaultOptions = {
  host: '',  // cdn域名
  dirName: "my-qiniu", // 项目前缀
  bk: '', // 七牛云bucket
  ak: '', // 七牛云登陆 ak
  sk: '', // 七牛云登陆 sk
  limit: 100, // 超过100字节的文件才上传
  includes: /.(jpg|png|gif|svg|webp)$/, // 包含的文件
  maxFile: 100, // 单次最大上传数量
  execution: undefined // 是否开启插件，默认情况下只有production环境执行插件上传任务
};

const unshiftLoader = (moduleContext, options = {}) => {
  if (!moduleContext.loaders) return;
  moduleContext.loaders = [{ loader: loaderPath, options }].concat(
    moduleContext.loaders
  );
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

    const mode = compiler.options.mode
    const execution = this.uploadOption.uploadOption
    // 如果用户设置了不执行插件，则不挂载钩子事件
    if (execution !== undefined && !execution) return
    // 默认情况下development环境不执行上传插件
    if (mode && mode === 'development' && !execution) return

    // 指定要附加到的事件钩子函数
    if (compiler.hooks) {
      compiler.hooks.thisCompilation.tap(
        "QiniuAutoPlugin",
        this.applyCompilerCallback
      );
      compiler.hooks.done.tap("QiniuAutoPlugin", this.startUploadAsstes);
    } else {
      compiler.plugin("this-compilation", this.applyCompilerCallback);
      compiler.plugin("done", this.startUploadAsstes);
    }
  }
  applyCompilerCallback(compilation) {
    if (compilation.hooks) {
      compilation.hooks.normalModuleLoader.tap(
        "QiniuAutoPlugin",
        this.comilationTapCallback
      );
      compilation.hooks.moduleAsset.tap(
        "QiniuAutoPlugin",
        this.getModulesOutputPath
      );
    } else {
      compilation.plugin("normal-module-loader", this.comilationTapCallback);
      compilation.plugin("module-asset", this.getModulesOutputPath);
    }
  }
  comilationTapCallback(loaderContext, moduleContext) {
    const {includes, excludes} = this.uploadOption;

    if (excludes && excludes.test(moduleContext.rawRequest)) {
      return
    }

    if (includes.test(moduleContext.rawRequest)) {
      unshiftLoader(moduleContext, this.uploadOption);
    }
  }
  getModulesOutputPath(moduleContext, fileName) {
    
    Qiniu.setLocalAsset(moduleContext.userRequest, {
      outputFile: fileName
    });
  }
  startUploadAsstes(compilation) {

    const outputPath = compilation.compilation.outputOptions.path
    Qiniu.modifyEachAsset((asset) => {
      return {
        ...asset,
        outputFile: path.resolve(outputPath, asset.outputFile)
      }
    })
    
    this.qiniu.uploadStart();
  }
}

module.exports = MyExampleWebpackPlugin;
