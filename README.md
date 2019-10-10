# QiNiu-Upload-Plugin

一款打包时根据远端文件对比自动上传所需资源到七牛云的 webpack 插件。

## 起因

开源的七牛云 webpack 上传插件基本都是在`afterEmit`钩子上将打包后的 assets 增量上传到七牛云，然后通过修改`publicPath`的方式将上传后 assets 的 src 替换成用户的 cdn 地址。但这样做会有一些痛点：

- 增量上传资源，使用 hash 文件名时会在云端留下大量冗余文件。
- 每次都会上传所有用户需要上传的的资源，即使在云端存在。
- 打包后在 dist 目录下存在无用资源（已上传到云端）。
- 通过`publicPath`修改引用前缀，则所有本地资源都必须上传到指定 cdn，包括 css/js 文件。

因此，我决定针对这些痛点自己撸一个上传插件（目前只支持图片文件）

## 特点

为每个项目定义一个命名空间，以命名空间为模块来控制云端文件，可以实现上传前置检查，优化上传。
在`normalModuleLoader`阶段为符合条件的资源添加一个解析 loader，通过 loader 更改文件的 src，避免配置`publicPath`。

- 每个项目在七牛云上会配置一个命名空间，如`/qiniu/your-asset.jpg`
- 无需配置`publicPath`
- 上传前会先检查云端是否有相同文件，如果没有则不上传
- 每次上传会删除云端无用文件，保持与项目同步
- 打包后会将 output 目录下已上传到云端的本地资源删除，避免服务器出现无用文件

## 配置

```base
yarn add qiniu-upload-webpack-plugin -D
```

```js
const QiNiuUploadPlug = require('qiniu-upload-webpack-plugin')

module.exports = {
    ...,
    plugin: [
        new QiNiuUploadPlug({
            host: '',  // cdn域名 必填
            dirName: "my-qiniu", // 项目前缀 必填
            bk: '', // 七牛云bucket 必填
            ak: '', // 七牛云登陆 ak 必填
            sk: '', // 七牛云登陆 sk 必填
            limit: 100, // 超过100字节的文件才上传 默认100
            mimeType: [".jpg", ".png", ".gif", ".svg", ".webp"], // 上传的文件后缀
            zone: null, // 储存机房 Zone_z0华东 Zone_z1华北 Zone_z2华南 Zone_na0北美
            includes: "/", // 包含的目录
            excludes: null, // 排除的目录
            maxFile: 100, // 单次最大上传数量
            increment: true, // 是否是增量上传，默认为true，非增量上传时会删除云端dirName下旧的无用文件
            execution: undefined // 是否开启插件，默认情况下只有production环境执行插件上传任务
        })
    ]
}

```
