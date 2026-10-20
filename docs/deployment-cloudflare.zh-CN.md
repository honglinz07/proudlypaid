# 在 Cloudflare 部署 Proudly Paid

[English](deployment-cloudflare.md) | **简体中文**

生产配置位于 `apps/api/wrangler.production.jsonc`。前端与 API 保持独立工作区；由一个 Worker 在同一域名下提供独立构建的 React 静态资源和现有只读 API。

## 资源

- 页面与 API：Worker `proudlypaid`，绑定自定义域名 `proudlypaid.com` 和 `www.proudlypaid.com`。
- 搜索数据库：D1 `proudlypaid-catalog`。生产配置中的数据库 ID 是公开资源标识，不是凭据。Fork 必须使用自己的数据库和域名。
- 恢复快照：私有 R2 桶 `proudlypaid-snapshots`。由部署命令行管理，不提供匿名下载或写入 API。Worker 只需要 D1 绑定。
- 本地开发继续使用 `apps/api/wrangler.jsonc` 和本地模拟存储。远程命令需要部署者明确登录自己的 Cloudflare 账号。

静态资源配置会先把 `/api` 和 `/api/*` 交给 Worker 处理，包括浏览器导航请求，避免缺失的 API 路由返回 `index.html`。直接访问 `/search`、`/faq`、`/manifesto` 和 `/contribute` 时加载 SPA。

## 部署 Fork 前

登录自己的 Cloudflare 账号，并将 `apps/api/wrangler.production.jsonc` 中官方实例的 Worker 名称、路由域名和区域 ID、D1 数据库绑定替换为自己的资源。[独立部署指南](deployment-lite.zh-CN.md#cloudflare-api-与-d1)说明了 D1 创建步骤。如果需要恢复快照，也应使用自己的私有 R2 桶；它与 Worker 的运行时绑定分开管理。

新数据库需要先检查写入预算，再完成下文的结构和目录初始化，搜索才能工作。部署代码不会初始化 D1。已有部署仅更新代码时，无需再次导入数据库。

## 构建与发布代码

```bash
npm ci
npm run check
npm run deploy:cloudflare
```

`check` 和 `build` 包含生产配置的 dry run 验证，只有 `deploy:cloudflare` 会实际发布到云端。部署命令构建两个工作区，将前端资源与 Worker 一起上传，不导入或修改数据库内容。源码映射随 Worker 上传，不属于公开前端资源。

自定义域名需要同一账号内已经激活的 Cloudflare 区域。Cloudflare 管理 Worker 路由和证书；配置中的 `workers.dev` 地址也可用于诊断。根域名和 www 都提供应用，当前没有主域名重定向。

### 已有的 Squarespace 停放记录

将域名服务器改到 Cloudflare 后，导入的 Squarespace 根域名 A 记录与 www 停放 CNAME 可能仍然存在。它们会继续把访客送到停放页，也可能使 Worker 自定义域名创建返回错误 `100117`。检查准确的记录，只移除目标网站主机名的停放记录，保留无关的邮箱 MX、SPF 和 DKIM。切换代理或清浏览器缓存不会把源站记录变成 Worker 绑定。清除冲突后重试部署，并检查两个域名的 HTTPS；不同解析器的 DNS 缓存仍可能延迟生效。

源码和反馈链接默认指向 `https://github.com/honglinz07/proudlypaid`。Fork 应在前端构建环境或 `apps/web/.env.local` 中，用 `VITE_REPOSITORY_URL` 覆盖为自己的 HTTPS 仓库地址。显式空值隐藏 GitHub 链接，但仍可在浏览器复制或下载研究草稿。不要把令牌放入任何 `VITE_` 配置。

## 导入或更新目录

### 先检查写入预算

首次导入 66,531 个项目时，导入命令报告写入 465,932 行；加上迁移，初始总量为 465,961 行。搜索索引和相关表也会计入写入量。这超过了 Workers 免费档每天 100,000 行的 D1 写入额度。免费档每日限额按账号累计，在 UTC 00:00（Asia/Shanghai 08:00）重置；触发限制可能影响后续查询，但不会删除已存数据。再次进行远程导入前，请核对最新的 [D1 定价](https://developers.cloudflare.com/d1/platform/pricing/)与[限额执行说明](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/)。

发布代码时不要重复全量导入。`deploy:cloudflare` 不执行 D1 迁移、种子导入或写入。免费档新部署应先检查预算，再从小型精选目录开始。目前的不可变快照格式会在新的研究快照中重复仓库身份记录，因此频繁导入完整快照不适合免费档每日写入额度。自动刷新数据之前，需要先实现增量索引更新或明确控制预算的导入流程。当前没有升级付费套餐，也没有定时导入任务。

对一个新数据库应用仓库中的结构迁移：

```bash
node scripts/wrangler.mjs d1 migrations apply DB --config wrangler.production.jsonc --remote
```

运行 `npm run catalog:seed` 只生成仓库内的精选目录。若要包含已有的仓库名称索引，可执行：

```bash
npm run catalog:seed -- --index .local/github-collection/index.jsonl --out .local/catalog-seeds/proudlypaid.sql
node scripts/wrangler.mjs d1 execute DB --config wrangler.production.jsonc --remote --file ../../.local/catalog-seeds/proudlypaid.sql --yes
```

包装脚本从 `apps/api/` 运行 Wrangler，传给它的路径相对于该目录解析。远程文件导入期间 D1 可能暂时不可用，后续导入应安排合适时段。种子 SQL 的最后一条语句激活按内容寻址的快照。导入之后、宣布更新之前，检查 `/api/health`。

首次生产数据包含 66,531 条仓库身份记录及已入库的研究目录。仓库被索引不代表已有审阅过的推荐，也不代表其开源许可证已确认。README 正文没有导入 D1，也没有上传到生产桶。

## R2 恢复快照

使用带版本的前缀 `catalog/<snapshot-version>/`，保存：

- `seed.sql`：仓库身份和原创研究记录，以及快照激活语句。
- `0001_catalog.sql`：重建数据库所需的结构与 FTS5 索引。
- `research.json`：生成种子 SQL 时使用的仓库内研究目录。
- `manifest.json`：快照标识、项目数量、范围、日期及 SHA-256 校验值。

通过 `node scripts/wrangler.mjs r2 object put <bucket>/<key> --remote --file <path>` 上传。保持桶的公开访问关闭，不上传凭据、私有环境文件或原始第三方 README 集合。将种子文件下载回来，比较 SHA-256 一致后，才能将其视为可用备份。

恢复时使用 `r2 object get <bucket>/<key> --remote --file <path>` 下载快照，校验所有哈希，再向一个**新的** D1 数据库应用结构和种子数据。验证当前版本和搜索结果后，才切换生产绑定。当前结构包含 FTS5 虚拟表，受 D1 导出限制影响；带版本的结构与种子文件是可复现的恢复输入。

首次快照版本为 `64505fe4692aa1bc43c83381894d28e1c429da55f8d452ee6ed4d97261660955`，位于 `proudlypaid-snapshots/catalog/` 下。

## 发布验收

检查 HTTPS、`/api/health` 和预期的快照版本与数量。尝试 Penpot、Bruno、拼写错误 `grafnaa`、已索引但尚无审阅推荐的项目，以及不存在的项目。未知 `/api/*` 路径即使作为页面打开，也必须返回 JSON 404。验证 SPA 深链接、中英文、窄屏及手动反馈流程。

### 首次上线的验证记录

- Worker 版本为 `81d23f10-4133-46b7-85cc-b44d83aaa1f5`；Cloudflare 接受了两个自定义域名。
- D1 迁移和完整的 66,531 项目快照只导入一次。回读当前版本成功，后续验证没有远程写入。
- 私有 R2 保存四个恢复对象，`r2.dev` 公开访问关闭，没有桶自定义域名。SQL 种子下载后的 SHA-256 与原始文件一致。
- 完整本地检查实际运行并通过 74 项测试。生产静态资源路由对 SPA 深链接返回 HTML，对未知 API 路径返回 JSON 404，包括导航请求。
- `www.proudlypaid.com` 的 HTTPS 返回预期目录版本。Penpot 返回三个已审阅替代品和两个价格组；Bruno 返回一个替代品和两个价格组。首页、搜索和反馈深链接返回应用，未知 API 返回 JSON 404。
- 公共解析器为根域名返回 Cloudflare 地址。当时正常代理请求仍返回 Squarespace，而通过可用的 www TLS 连接发送根域名 Host 头，能取得正确 Worker 目录。这区分了根域名路由和客户端解析路径，不表示所有解析器缓存均已刷新。最后验收时公开网站的浏览器自动化不可用，使用本地界面与线上 HTTP 检查。
- D1 信息接口报告初始 24 小时写入 465,961 行，当时只读目录检查仍成功。没有升级付费套餐、再次导入、定时更新或新增写入接口。

代码回滚使用 Wrangler 的版本化部署，不会回滚 D1。更新数据时保留前一个有效快照及恢复输入。本版本没有定时抓价、自动批准研究记录或向量搜索。

参考：[Workers 静态资源](https://developers.cloudflare.com/workers/static-assets/)、[自定义域名](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)、[D1 导入导出与限制](https://developers.cloudflare.com/d1/best-practices/import-export-data/)、[R2 Wrangler 命令](https://developers.cloudflare.com/r2/reference/wrangler-commands/)。
