const qiniu = require("qiniu");
const logger = require("./log");
const fs = require("fs");
const loaderUtils = require("loader-utils");
// 本地资源信息映射
var LocalAssetsMap = {};

class QiNiu {
  constructor(options = {}) {
    this.accessKey = options.ak;
    this.secretKey = options.sk;
    this.bucket = options.bk;
    this.dirname = options.dirname;
    this.maxFile = options.maxFile;
    this.zone = options.zone;
    this.increment = options.increment;
    this._init();
  }
  _init() {
    if (!this.accessKey || !this.secretKey) {
      this._Error = "Missing AccessKey";
      return;
    }
    if (!this.secretKey) {
      this._Error = "Missing SecretKey";
      return;
    }
    if (!this.bucket) {
      this._Error = "Missing Bucket Name";
      return;
    }

    this.config = new qiniu.conf.Config();
    if (this.zone) {
      this.config.zone = qiniu.zone[this.zone];
    }
    this.mac = new qiniu.auth.digest.Mac(this.accessKey, this.secretKey);
    this.bucketManager = new qiniu.rs.BucketManager(this.mac, this.config);
    this.formUploader = new qiniu.form_up.FormUploader(this.config);
  }
  // 开始执行上传任务
  async uploadStart() {
    if (this._Error) {
      // 如果构建上传任务报错，则终止
      logger.error(this._Error);
      return;
    }
    logger.info("Start qiniu upload >>>");

    // 拉取远端目录
    const { queryList, error } = await this.queryOriginFileList()
      .then(queryList => ({ queryList }))
      .catch(error => ({ error }));

    if (error) {
      logger.error(error);
      return;
    }

    const UploadAssetsMap = this._getUploadAssetMap(LocalAssetsMap);
    const [uploadItems, deleteItems] = this.checkOriginItem(
      queryList.items,
      UploadAssetsMap
    );
    await this.batchDelete(deleteItems, this.increment);
    await this.batchUpload(uploadItems);
    await this.clearLocalAssets();

    logger.success("--- End ---");
  }
  // 批量上传远端文件
  batchUpload(uploadItems) {
    if (!uploadItems.length) return;
    logger.info("uploading...");
    const uploadPromiseQueue = uploadItems.map(asset =>
      this._uploadFile(asset)
    );

    return Promise.all(uploadPromiseQueue)
      .then(res => {
        const resLogger = res.map(url => `\n + ${url}`).join("");
        logger.success(`Upload succeeded ${resLogger}`);
      })
      .catch(error => {
        logger.error(error);
      });
  }
  // 批量删除远端文件
  batchDelete(deleteItems, increment) {
    if (increment) return Promise.resolve(); // 增量上传不删除旧文件
    return new Promise((resolve, reject) => {
      if (!deleteItems.length) {
        resolve();
        return;
      }

      const bucket = this.bucket;
      const deleteOptions = deleteItems.map(item =>
        qiniu.rs.deleteOp(bucket, item.key)
      );
      this.bucketManager.batch(deleteOptions, function(err) {
        if (err) {
          logger.error(err);
          reject(err);
        } else if (deleteItems.length) {
          const deleteLogger = deleteItems
            .map(item => `\n - ${item.key}`)
            .join("");
          logger.warn(`Remote deleted ${deleteLogger}`);
          resolve();
        }
      });
    });
  }
  // 上传文件
  _uploadFile(asset) {
    return new Promise((resolve, reject) => {
      const putPolicy = new qiniu.rs.PutPolicy({
        scope: this.bucket + ":" + asset.uploadKey
      });
      const putExtra = new qiniu.form_up.PutExtra();
      const uploadToken = putPolicy.uploadToken(this.mac);
      let uploadFilePath = "";
      asset.outputFiles.forEach(outputPath => {
        // 判断一下路径是否存在
        if (fs.existsSync(outputPath)) {
          uploadFilePath = outputPath;
        }
      });

      this.formUploader.putFile(
        uploadToken,
        asset.uploadKey,
        uploadFilePath,
        putExtra,
        function(err, body) {
          if (err) {
            reject(err);
          } else {
            resolve(body.key);
          }
        }
      );
    });
  }
  // 剔除不需要上传的资源
  _getUploadAssetMap(LocalAssetsMap) {
    const uploadAssetMap = {};
    Object.keys(LocalAssetsMap).forEach(key => {
      if (LocalAssetsMap[key].emit) {
        uploadAssetMap[key] = LocalAssetsMap[key];
      }
    });
    return uploadAssetMap;
  }
  // 将本地资源列表与远端资源列表做对比,筛选出需要上传的本地资源与需要删除的远端资源,不重复上传
  checkOriginItem(items = [], LocalAssetsMap) {
    const needDeleteItems = []; // 需要删除的远端资源列表
    const needUploadAssets = []; // 需要上传的本地资源列表
    const uploadKeyAssetMap = {}; // 一个以uploadKey为键值的Object，便于后续操作

    Object.keys(LocalAssetsMap).forEach(key => {
      // 将localAssetsMap以uploadKey为键值映射到uploadKeyAssetMap
      uploadKeyAssetMap[LocalAssetsMap[key].uploadKey] = LocalAssetsMap[key];
    });

    // 先遍历远端资源，筛选出需要删除的无用远端文件
    items.forEach(item => {
      const { key } = item;
      if (!uploadKeyAssetMap[key]) {
        needDeleteItems.push(item);
      }
    });

    // 遍历本地资源，如果远端不存在则上传
    Object.keys(uploadKeyAssetMap).forEach(key => {
      if (!fs.existsSync(uploadKeyAssetMap[key].request)) {
        return;
      }
      const assetSource = fs.readFileSync(uploadKeyAssetMap[key].request);
      const hash = loaderUtils.getHashDigest(assetSource);
      if (items.find(item => item.key === key && item.md5 === hash)) return;
      needUploadAssets.push(uploadKeyAssetMap[key]);
    });

    return [needUploadAssets, needDeleteItems];
  }
  // 获取七牛云远端文件列表
  queryOriginFileList() {
    return new Promise((resolve, reject) => {
      const queryOptions = {
        limit: this.maxFile,
        prefix: this.dirname
      };

      this.bucketManager.listPrefix(this.bucket, queryOptions, function(
        err,
        body
      ) {
        if (err) {
          reject(err);
        } else if (body.error) {
          reject(body.error);
        } else {
          resolve(body);
        }
      });
    });
  }
  // 清除上传七牛云的本地无用资源
  clearLocalAssets() {
    return new Promise(resolve => {
      try {
        const uploadAssets = this._getUploadAssetMap(LocalAssetsMap);
        Object.keys(uploadAssets).forEach(key => {
          uploadAssets[key].outputFiles.forEach(filePath => {
            // 判断一下路径是否存在
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              logger.info(`Cleared asset: ${filePath}`);
            }
          });
        });
      } catch (e) {
        logger.error("Clear Error: " + e.message);
      }
      resolve();
    });
  }
}

/**@typedef {{outputFile?: String, uploadKey?: String, hash?: String, mimeType?: String, request?: String}} LocalAsset*/
/**
 * 添加本地资源到LocalAssetsMap对象中
 * @param {String} uploadKey
 * @param {LocalAsset} asset
 */
module.exports.setLocalAsset = function(userRequest, asset = {}) {
  LocalAssetsMap[userRequest] = LocalAssetsMap[userRequest]
    ? Object.assign({}, LocalAssetsMap[userRequest], asset)
    : asset;
};

// 遍历LocalAssetsMap对象的键值，通过回调函数生成一个新的LocalAssetsMap，类似Array.map
module.exports.modifyEachAsset = function(callback) {
  const newLocalAssetsMap = {};
  Object.keys(LocalAssetsMap).forEach(key => {
    newLocalAssetsMap[key] = callback(LocalAssetsMap[key], key);
  });
  LocalAssetsMap = newLocalAssetsMap;
};

module.exports.createQiNiu = QiNiu;
