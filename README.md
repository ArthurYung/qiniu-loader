# QiNiu-Upload-Plugin

一款打包时根据远端文件对比自动上传所需资源到七牛云的webpack插件。

## 起因
开源的七牛云webpack上传插件基本都是在`afterEmit`钩子上将打包后的assets增量上传到七牛云，然后通过修改`publicPath`的方式将上传后assets的src替换成用户的cdn地址。但这样做会有一些痛点：
- 增量上传资源，使用hash文件名时会在云端留下大量冗余文件。
- 每次都会上传所有用户需要上传的的资源，即使在云端存在，浪费。
- 打包后在dist目录下存在无用资源（已上传到云端），不完美。
- 通过`publicPath`修改引用前缀，则所有本地资源都必须上传到指定cdn，包括css/js文件，不友好。

因此，我决定针对这些痛点自己撸一个上传插件（目前只支持图片文件）

## 特点
为每个项目定义一个命名空间，以命名空间为模块来控制云端文件，可以实现上传前置检查，优化上传。
在`normalModuleLoader`阶段为符合条件的资源添加一个解析loader，在loader上更改文件的src，避免配置`publicPath`。   

- 每个项目在七牛云上会配置一个命名空间，如`/qiniu/your-asset.jpg`
- 无需配置`publicPath`
- 上传前会先检查云端是否有相同文件，如果没有则不上传
- 每次上传会删除云端无用文件，保持与项目同步
- 打包后会将output目录下已上传到云端的本地资源删除，避免服务器出现无用文件

## 配置

```js
import QiNiuUploadPlug = require('qiniu-upload-plugin')

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
            mimeType: ['.jpg', '.png', '.gif', '.svg', '.webp'], // 要上传的文件后缀，默认为图片
            includes: '/', // 包含的文件目录
            excludes: null, // 不包含的文件目录。
            maxFile: 100, // 单次最大上传数量 默认100
            execution: undefined, // 是否开启插件，默认情况下只有production环境执行插件上传任务
        })
    ]
}

```
