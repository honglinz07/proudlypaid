# 部署轻量版

[English](deployment-lite.md) | **简体中文**

本指南介绍前端与 API 独立部署。同一域名下的 Worker + D1 + 私有 R2 生产部署见 [Cloudflare 部署指南](deployment-cloudflare.zh-CN.md)。生产数据库标识属于公开配置，源码不包含凭据。`apps/api/wrangler.jsonc` 的全零 D1 ID 仍是本地占位值；以下远程命令是手动部署步骤，不属于 `npm run check`。

## 本地验证

```bash
npm ci
npm run db:local -- --curated-only
npm run check
npm run dev
```

打开 <http://127.0.0.1:5273/search?q=Penpot>。API 使用 8787 端口。本地 D1 状态保存在 `.local/worker-state/`，前端构建输出为 `apps/web/dist/`，Worker dry run 输出为 `apps/api/dist/`。以上步骤无需账号或令牌。若要使用已有的完整本地 GitHub 索引，运行 `npm run db:local`，不加 `--curated-only`。

## Cloudflare API 与 D1

部署者自行登录 Wrangler，或通过部署环境提供具有适当权限的凭据。不要把令牌放进源码、配置、命令历史或生成的 SQL。`scripts/wrangler.mjs` 从 `apps/api/` 运行已锁定版本的 CLI，配置和迁移路径会按同一目录解析。

任何远程迁移或导入前，都要检查 [D1 写入预算](deployment-cloudflare.zh-CN.md#先检查写入预算)。搜索索引会增加实际写入行数。先从精选目录开始，并核对账号当前额度；发布代码不需要重新导入数据。

1. 创建数据库：

   ```bash
   node scripts/wrangler.mjs d1 create closedsources-catalog
   ```

2. 将返回的数据库 ID 填入 `apps/api/wrangler.jsonc` 的 `DB` 绑定，替换本地占位值。数据库 ID 不是凭据，必须使用自己账号下的 ID。除非有意进行远程开发，不要给本地绑定添加 `remote: true`。
3. 对该远程数据库应用仓库内的迁移：

   ```bash
   node scripts/wrangler.mjs d1 migrations apply DB --remote
   ```

4. 从仓库内研究目录生成种子 SQL，并远程导入：

   ```bash
   npm run catalog:seed
   node scripts/wrangler.mjs d1 execute DB --remote --file ../../.local/catalog-seeds/catalog.sql
   ```

   若要包含已采集的名称索引，导入前明确使用 `npm run catalog:seed -- --index .local/github-collection/index.jsonl` 生成种子 SQL。文件包含仓库元数据和原创研究记录，不含 README 正文或凭据。明确决定发布哪些元数据，并保留来源报告中关于采集完整性的说明。

5. 验证配置后的构建产物并部署 Worker：

   ```bash
   npm run build --workspace @closedsources/api
   node scripts/wrangler.mjs deploy
   ```

6. 检查线上 `/api/health`、名称查询和包含编码仓库路径的详情接口。目录版本与数量应符合预期导入结果。未初始化的目录会明确返回 503。

迁移和快照激活用途不同：迁移修改数据库结构；导入更新目录时，创建新的不可变数据快照，在末尾切换当前指针。保留多个版本前，应做好备份并监测存储。相同导入会复用已有记录，但失败或已被替代的快照不会自动清理。本版本没有保留期清理命令或定时更新任务。

账号相关操作与当前平台行为请参考官方 [D1 迁移](https://developers.cloudflare.com/d1/reference/migrations/)、[D1 导入](https://developers.cloudflare.com/d1/best-practices/import-export-data/)及 [Wrangler 命令](https://developers.cloudflare.com/workers/wrangler/commands/)。云端资源按账号套餐和实际使用情况计费。

## 静态前端与同源 API

源码和反馈链接默认指向 `https://github.com/honglinz07/proudlypaid`。Fork 应将前端构建的 `VITE_REPOSITORY_URL` 覆盖为自己的 HTTPS GitHub 仓库地址。本地可参照 `.env.example` 使用 `apps/web/.env.local`，修改后重新构建。这是公开地址，不是密钥。显式空值隐藏 GitHub 链接，同时保留草稿复制和下载。详见 [测试版发布说明](release-beta.zh-CN.md)。

使用 `npm run build --workspace @closedsources/web` 构建，将 `apps/web/dist/` 上传到支持 SPA 回退的静态主机。必须**先**把 `/api/*` 路由到 Worker，再处理 SPA 回退。可通过 Cloudflare 自定义域名 Worker 路由或反向代理实现同源边界。生产前端始终请求相对路径 `/api/...`；Vite 代理只用于本地开发和预览。

例如，已经提供前端静态资源的 Nginx 网关，可以保持完整 API 路径：

```nginx
location /api/ {
    proxy_pass https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev;
    proxy_ssl_server_name on;
    proxy_ssl_verify on;
    proxy_ssl_trusted_certificate /etc/ssl/certs/ca-certificates.crt;
    proxy_set_header Host YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev;
}
location / {
    try_files $uri $uri/ /index.html;
}
```

替换示例域名，并配置网关的 TLS、静态资源根目录和访问日志。上面的 CA 证书路径是 Debian/Ubuntu 示例，应使用本机受信任的证书集合，同时保持上游证书校验开启。使用原生 Cloudflare 路由无需 Nginx。当前没有跨域 API 模式，单纯把前端和 Worker 放到不同主机名下无法连接搜索。浏览器请求 `/api` 路径时，必须收到 JSON，包括 API 的 404/503，而不是 SPA 页面。

前端 404 由客户端渲染，未知 SPA 路径的 HTTP 404 状态取决于主机。SPA 回退要包含 `/contribute`。应用没有搜索历史数据库或统计分析，但仍应单独检查基础设施的请求日志设置。反馈草稿在浏览器生成，不会提交到此 API。

## 本版本范围

当前支持名称、别名和仓库匹配，以及有限的拼写纠错。VPS 打包、PostgreSQL、向量化、语义排序、自动产品发现、实时抓价和价格历史任务尚未实现。后续可以复用研究目录和 `@closedsources/contracts`，不让前端依赖特定存储引擎。
