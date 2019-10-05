const qiniu = require("qiniu");
const chalk = require("chalk");
const fs = require("fs");
// 本地资源信息映射
const LocalAssetsMap = {};

class QiNiu {
  constructor(options = {}) {
    this.accessKey = options.ak;
    this.secretKey = options.sk;
    this.bucket = options.bk;
    this.dirname = options.dirname;
    this.maxFile = options.maxFile;
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
    this.mac = new qiniu.auth.digest.Mac(this.accessKey, this.secretKey);
    this.bucketManager = new qiniu.rs.BucketManager(this.mac, this.config);
    this.formUploader = new qiniu.form_up.FormUploader(this.config);
  }
  async uploadStart() {
    if (this._Error) {
      console.log(chalk`{red.bold [QiNiu Plugin] ${this._Error}}`);
      return;
    }

    const { queryList, error } = await this.queryOriginFileList()
      .then(queryList => ({ queryList }))
      .catch(error => ({ error }));
    console.log("list: " + queryList);
    if (error) {
      console.log(chalk`{red.bold [QiNiu Plugin] ${error}}`);
      return;
    }
    console.log(chalk`{blue.bold [QiNiu Plugin] Start qiniu upload >>>}`);
    const UploadAssetsMap = this._getUploadAssetMap(LocalAssetsMap);
    const [uploadItems, deleteItems] = this.checkOriginItem(
      queryList.items,
      UploadAssetsMap
    );

    this.batchUpload(uploadItems);
    this.batchDelete(deleteItems);
    this.clearAssets(UploadAssetsMap);
  }
  batchUpload(uploadItems) {
    console.log(uploadItems);
    const uploadPromiseQueue = uploadItems.map(asset =>
      this._uploadFile(asset)
    );
    Promise.all(uploadPromiseQueue)
      .then(res => {
        console.log(chalk`{green.bold [QiNiu Plugin] [${res}] is uploaded}`);
      })
      .catch(error => {
        console.log(error);
      });
  }
  batchDelete(deleteItems) {
    const bucket = this.bucket;
    const deleteOptions = deleteItems.map(item =>
      qiniu.res.deleteOp(bucket, item.key)
    );
    this.bucketManager.batch(deleteOptions, function(err) {
      if (err) {
      } else {
        const deleteKeys = deleteItems.map(item => item.key);
        console.log(
          chalk`{yellow.bold [QiNiu Plugin] ${deleteKeys} is deleted}`
        );
      }
    });
  }
  clearAssets(assetMap) {
    Object.keys(assetMap).forEach(path => {
      fs.rmdirSync(path);
    });
  }
  _uploadFile(asset) {
    console.log(asset);
    return new Promise((resolve, reject) => {
      const putPolicy = new qiniu.rs.PutPolicy({
        scope: this.bucket + ":" + asset.uploadKey
      });
      const putExtra = new qiniu.form_up.PutExtra();
      const uploadToken = putPolicy.uploadToken(this.mac);

      this.formUploader.putFile(
        uploadToken,
        asset.uploadKey,
        asset.request,
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
  _getUploadAssetMap(LocalAssetsMap) {
    // 剔除不需要上传的资源
    const uploadAssetMap = {};
    Object.keys(LocalAssetsMap).forEach(key => {
      if (LocalAssetsMap[key].emit) {
        uploadAssetMap[key] = LocalAssetsMap[key];
      }
    });
    return uploadAssetMap;
  }
  checkOriginItem(items = [], LocalAssetsMap) {
    console.log(items);
    const needDeleteItems = [];
    const needUploadAssets = [];
    const uploadKeyAssetMap = {};

    Object.keys(LocalAssetsMap).forEach(key => {
      uploadKeyAssetMap[LocalAssetsMap[key].uploadKey] = LocalAssetsMap[key];
    });

    items.forEach(item => {
      const { key, mimeType, md5: hash } = item;
      if (uploadKeyAssetMap[key]) {
        if (uploadKeyAssetMap[key].mimeType !== mimeType) {
          needDeleteItems.push(item);
          return;
        }
        if (uploadKeyAssetMap[key].hash !== hash) {
          needDeleteItems.push(item);
          return;
        }
      } else {
        needDeleteItems.push(item);
      }
    });

    Object.keys(uploadKeyAssetMap).forEach(key => {
      if (items.find(item => item.key === key)) return;
      needUploadAssets.push(uploadKeyAssetMap[key]);
    });

    return [needUploadAssets, needDeleteItems];
  }
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
}

/**@typedef {{outputPath?: String, uploadKey?: String, hash?: String, mimeType?: String, request?: String}} LocalAsset*/
/**
 * @param {String} uploadKey
 * @param {LocalAsset} asset
 */
module.exports.setLocalAsset = function(userRequest, asset = {}) {
  LocalAssetsMap[userRequest] = LocalAssetsMap[userRequest]
    ? Object.assign({}, LocalAssetsMap[userRequest], asset)
    : asset;
};

module.exports.createQiNiu = QiNiu;
