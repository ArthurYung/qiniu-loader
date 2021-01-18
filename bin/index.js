const path = require("path");
const Qiniu = require("./qiniu");
const loaderPath = path.resolve(__dirname, "loader.js");

// 默认配置
const defaultOptions = {
  host: "", // cdn域名
  dirname: "", // 项目前缀
  bk: "", // 七牛云bucket
  ak: "", // 七牛云登陆 ak
  sk: "", // 七牛云登陆 sk
  limit: 100, // 超过100字节的文件才上传
  mimeType: [".jpg", ".png", ".gif", ".svg", ".webp"], // 上传的文件后缀（public模式无效）
  excludeType: [".html", ".json", ".map"], // 不上传的文件后缀
  zone: null, // 储存机房 Zone_z0华东 Zone_z1华北 Zone_z2华南 Zone_na0北美
  includes: "/", // 包含的文件目录
  excludes: [], // 排除的文件目录
  maxFile: 100, // 单次最大上传数量
  increment: true, // 是否是增量上传，默认为true，非增量上传时会删除云端dirname下旧的无用文件
  execution: null, // 是否开启插件，默认情况下只有production环境执行插件上传任务
  mode: "pic", // 模式 public为上传全部资源，会替换掉项目的publicPath
};

const unshiftLoader = (moduleContext, options = {}) => {
  if (!moduleContext.loaders) return;
  moduleContext.loaders = [{ loader: loaderPath, options }].concat(
    moduleContext.loaders
  );
};

class QiNiuAutoUploadPlugin {
  constructor(options = {}) {
    this.uploadOption = Object.assign({}, defaultOptions, options);
    this.applyCompilerCallback = this.applyCompilerCallback.bind(this);
    this.comilationTapCallback = this.comilationTapCallback.bind(this);
    this.getModulesOutputPath = this.getModulesOutputPath.bind(this);
    this.startUploadAssets = this.startUploadAssets.bind(this);
    this.setUploadFilterOption = this.setUploadFilterOption.bind(this);
    this.checkExcludesPath = this.setUploadFilterOption.bind(this);
    this.startUploadByPublic = this.startUploadByPublic.bind(this);

    this.qiniu = new Qiniu.createQiNiu(this.uploadOption);
  }
  // 将 `apply` 定义为其原型方法，此方法以 compiler 作为参数
  apply(compiler) {
    const context = compiler.context;
    const mode = compiler.options.mode;
    const execution = this.uploadOption.execution;
    // 保存上传资源筛选条件
    this.setUploadFilterOption(context);
    // 如果用户设置了不执行插件，则不挂载钩子事件
    if (execution !== null && !execution) return;
    // 默认情况下development环境不执行上传插件
    if (mode && mode === "development" && !execution) return;

    if (this.uploadOption.mode === "public") {
      compiler.hooks.compilation.tap("QiniuAutoPlugin", (compilation) => {
        compilation.outputOptions.publicPath =
          this.uploadOption.host + "/" + this.uploadOption.dirname + "/";
        this.outputPath = compilation.outputOptions.path;
      });
      // 兼容nuxt， 服务端代码不上传七牛
      if (compiler.options.name === "server") return;
      compiler.hooks.done.tap("QiniuAutoPlugin", this.startUploadByPublic);
    } else {
      compiler.hooks.thisCompilation.tap(
        "QiniuAutoPlugin",
        this.applyCompilerCallback
      );
      compiler.hooks.done.tap("QiniuAutoPlugin", this.startUploadAssets);
    }
  }
  setUploadFilterOption(context) {
    const { includes, excludes, mimeType, excludeType, mode } = this.uploadOption;
    this.uploadOption.mimeTypeReg = new RegExp(`(${mimeType.join("|")})$`);
    this.uploadOption.includesPath = path.resolve(context, includes);
    this.uploadOption.excludeTypeReg = new RegExp(
      `(${excludeType.join("|")})$`
    );

    if (Array.isArray(excludes)) {
      const prefix = mode == 'pic' ? path.resolve(context) + '/' : ''
      this.uploadOption.excludePaths = excludes.map(
        (exclude) => new RegExp(`^${prefix}${exclude}`)
      );
    }
  }

  checkExcludesPath(path) {
    const { excludePaths = [] } = this.uploadOption
    for (let i = 0; i < excludePaths.length; i++) {
      if(excludePaths.test(path)) return true
    }
    return false
  }

  applyCompilerCallback(compilation) {
    compilation.hooks.normalModuleLoader.tap(
      "QiniuAutoPlugin",
      this.comilationTapCallback
    );
    compilation.hooks.moduleAsset.tap(
      "QiniuAutoPlugin",
      this.getModulesOutputPath
    );
  }
  comilationTapCallback(loaderContext, moduleContext) {
    const { includesPath, mimeTypeReg } = this.uploadOption;

    if (this.checkExcludesPath(moduleContext.userRequest)) {
      return;
    }

    if (!mimeTypeReg.test(moduleContext.userRequest)) {
      return;
    }
    if (moduleContext.userRequest.indexOf(includesPath) === 0) {
      unshiftLoader(moduleContext, this.uploadOption);
    }
  }
  getModulesOutputPath(moduleContext, fileName) {
    Qiniu.setLocalAsset(moduleContext.userRequest, {
      outputFile: fileName,
    });
  }
  startUploadByPublic(compilation) {
    const dirname = this.uploadOption.dirname;
    const outputPath = compilation.compilation.outputOptions.path;
    Object.keys(compilation.compilation.assets).forEach((fileName) => {
      if (this.uploadOption.excludeTypeReg.test(fileName)) return;
      if (this.checkExcludesPath(fileName)) return;
      const outputFile = path.resolve(outputPath, fileName);
      Qiniu.setLocalAsset(fileName, {
        outputFile,
        outputFiles: [outputFile],
        emit: true,
        request: outputFile,
        uploadKey: dirname + "/" + fileName,
      });
    });
    this.startUploadAssets(compilation);
  }
  startUploadAssets(compilation) {
    const outputPath = compilation.compilation.outputOptions.path;
    Qiniu.modifyEachAsset((asset) => {
      const outputFiles = asset.outputFiles || [];
      outputFiles.push(path.resolve(outputPath, asset.outputFile));
      return {
        ...asset,
        outputFiles,
      };
    });

    this.qiniu.uploadStart();
  }
}

module.exports = QiNiuAutoUploadPlugin;
