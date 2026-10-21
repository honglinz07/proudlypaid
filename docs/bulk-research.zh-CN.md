# 批量发现与产品官网取证

[English](bulk-research.md) | **简体中文**

工具在本地 Node.js 24.5+ 环境批量导入关系线索，按产品归并，再集中采集可复用的官网证据。不修改研究目录、原始 GitHub 采集或 D1。全部结果保持 `needs-review`；价格样式的数字不代表套餐、闭源分类或替代关系已核验。

## 导入

需要已有 GitHub 采集索引。先执行 `npm ci` 安装依赖，再运行：

```bash
npm run catalog:import
```

导入器下载 [Macrostack 的公开替代品 JSON](https://www.macrostack.net/data)、[awesome-saas-alternatives 的产品 JSON](https://github.com/Emmraan/awesome-saas-alternatives)及后者的 MIT 许可原文。用 `.local/github-collection/index.jsonl` 对应仓库，用 `data/catalog/product-identities.json` 归并已知别名并补充入口。每次新建 `.local/catalog-bulk/run-*/`，包含：

- `products.json`：官网采集器使用的产品分组与官网/价格页入口。
- `relationships.jsonl`：全部候选，包括未匹配索引的仓库，带来源哈希、JSON 指针或 README 证据 ID。
- `sources/`、`SOURCES.md`：原始输入、署名和许可原文。Macrostack 数据仍采用 CC-BY-4.0，不因导入而改成 MIT。
- `report.json`、`source-rows-needing-review.json`：实际数量和身份/格式需要核对的来源行。

不会把替代品一端的官网与价格错当成目标产品的事实。官网入口来自身份表，或 SaaS 清单中名称完全对应的产品。同一公司域名下的不同产品继续分开。缺失身份、未知别名、组合产品名称及第三方断言仍需核验。

复用快照，并可选择接入一批明确的 `catalog:group` 输出：

```bash
npm run catalog:import -- --from /path/to/source-snapshots --index /path/to/collection/index.jsonl --readme-groups /path/to/review/products.json
```

快照需要包含 `macrostack.json`、`awesome-saas-alternatives.json`、`awesome-saas-license.txt`。README 分组保留原证据；提及的对象可能是赞助商或其他项目。`--out DIRECTORY` 可换输出根目录。输入只读，输出不能位于来源目录内。

## 采集与续跑

把 `run-EXAMPLE` 换成实际导入目录：

```bash
npm run catalog:pages -- --input .local/catalog-bulk/run-EXAMPLE/products.json --max-products 20 --max-requests 100
```

默认每轮尝试 20 个产品、最多 100 次请求（包含 robots 与跳转），网页/产品缓存 168 小时。每个产品最多采集四页：给定的官网/价格入口，以及网页明确链接的价格或服务条款页。不猜价格路径、不提交表单。缺官网的产品生成身份核验任务。

重复执行同一命令会继续尚未处理的产品。检查点和内容哈希缓存可跨中断复用；处理中断的产品继续使用已抓到的页面。每次在 `.local/catalog-page-runs/run-*/` 输出累计的 `review-drafts.json`、`report.json` 和易读的 `review-summary.md`。`paused` 表示达到本轮预算；`complete-with-gaps` 表示已尝试，但仍有身份/页面缺口。两者都不代表推荐已核验。

```bash
npm run catalog:pages -- --input .local/catalog-bulk/run-EXAMPLE/products.json --max-products 20 --max-requests 100 --retry-failed
```

`--retry-failed` 在新产品之后重试缺身份或网页未成功的产品，仍遵守冷却时间。`--max-age-hours N` 控制新鲜度；robots 策略 24 小时过期。`--cache DIRECTORY`、`--out DIRECTORY` 可换缓存和报告根目录。同一缓存只运行一个采集进程。工具不会安装定时任务或后台服务。

## 抓取与证据

产品页面请求使用明确的 `ProudlyPaidResearch` 标识，逐个目标 origin 检查 robots.txt，并遵守禁止规则、抓取间隔和 Retry-After。只有 robots 返回 404/410 才视为不存在；策略不可读/被拒绝时暂缓页面。请求串行执行，同站至少间隔一秒；每次请求及正文读取超时 15 秒，限制文本大小与跳转次数。不携带 Cookie 或凭据，登录限制和浏览器验证页记为待处理结果。TLS 校验保持开启。

只接受公开 HTTPS URL，拒绝凭据、IP 字面量主机和解析到私有/本地网络的域名。这是可信操作者运行的 CLI，不应直接暴露为公众可调用的 URL 抓取接口。命令通过 Node 的 `--use-env-proxy` 使用明确配置的 `HTTPS_PROXY`/`HTTP_PROXY`，不修改系统代理、不发现凭据。Windows 仅开启系统代理未必会配置 Node。

草稿保留来源 URL、获取时间、解码文本 SHA-256、标题、有限预览和价格样式片段；报告记录提取器版本。片段行号属于规范化后的提取文本，不是原始 HTML 行号。解码原文只保存在 `.local/catalog-page-cache/objects/`，作为内部第三方研究输入，不自动公开为产品描述。

向 `data/catalog/pilot.json` 添加原创摘要前，继续核对产品范围、功能重叠、服务许可、币种、单位、账期和配置。不确定的观察继续待审。D1 快照发布需另外核算预算；本工具不迁移、不导入数据库、不部署。

## 验证

```bash
npm run test:catalog
npm run check
```

测试覆盖来源署名、目标与替代品分离、别名归并、输入保留、robots 禁止规则、URL/DNS 检查、跳转、正文大小、检查点推进、共享网页缓存、请求预算、浏览器验证页及跨轮次限流冷却。

链接提取会排除隐私页、帮助文章、词汇表和部门介绍页，并优先选择直接协议而非法律目录；这些仍只是待核验链接。审阅发现 Jotform、Superblocks 条款限制自动采集，因此对这些域名的新请求会转为人工核验或取得明确许可。此前留存证据不会被直接公开。
