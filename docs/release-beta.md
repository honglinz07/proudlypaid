# 首个测试版发布说明

状态：Proudly Paid 已部署到 Worker、生产 D1 和私有 R2，根域名与 www 已绑定。www 的页面、真实搜索及 API 路由已通过线上 HTTP 验收；直连 Cloudflare 的根域名正常，当前代理访问根域名仍出现旧 Squarespace 页面。首次全量索引导入触发 D1 写入提醒，已停止进一步远程写入，后续代码部署不导入数据。公开仓库为 [honglinz07/proudlypaid](https://github.com/honglinz07/proudlypaid)，源码和反馈入口默认使用这个地址。站点代码、前后端和原创研究摘要均采用 MIT；依赖、第三方 README 与素材保留各自许可。当前生产部署步骤见 [Cloudflare 部署说明](deployment-cloudflare.md)。

## 这个版本可以做什么

- 使用独立 Workers + D1 API 搜索名称、别名和仓库地址，支持有限拼写纠错。
- 展示经过审阅的替代关系及带配置、来源和日期的价格；只在相同币种、单位和账期内按单价降序排列。
- 页面标注 Beta，说明“仓库已索引”不等于“已有推荐”。首页提供六个已覆盖的示例入口。
- 从空结果或已有推荐进入 `/contribute`，整理申请收录、替代品或纠正线索，复制或下载 Markdown。
- 源码弹窗和反馈页提供公开仓库链接；用户在 GitHub 自行确认提交，Fork 可覆盖目标仓库地址。

本地研究目录截至 2026-10-20 为 24 个项目、34 个产品、54 组研究关系；37 组可发布关系覆盖 19 个项目。干净源码默认只包含这份精选目录，不包含私人本地采集集、原始 README、账号或令牌。全量名称索引可由部署者选择另行导入。

## 从干净源码运行

需要 Node.js 24+ 和 npm 11+。在源码根目录执行：

```bash
npm ci
npm run db:local -- --curated-only
npm run check
npm run dev
```

浏览器打开 <http://127.0.0.1:5273>。停止后重新运行 `npm run dev` 即可使用已有本地数据库。上述步骤不需要 GitHub 或 Cloudflare 凭据。

首轮试用可验证：Penpot 的 Figma/UXPin 分组、Bruno 的 Postman 个人/团队分组、Appsmith 的 Retool 欧元角色分组、Formbricks 的待审价格提示，以及 Supabase 的“已找到仓库、推荐待补充”状态。

## Fork 与 GitHub 链接

1. Fork [公开仓库](https://github.com/honglinz07/proudlypaid)，保留 MIT 许可证、锁文件、CI 和 issue 模板。不要上传 `.local/`、`node_modules/`、构建输出或环境私有配置。
2. 默认地址指向官方仓库。部署自己的 Fork 时，将 `apps/web/.env.example` 复制为同目录的 `.env.local`，把 `VITE_REPOSITORY_URL` 改成自己的真实仓库网页地址，例如 `https://github.com/你的账号/仓库名`。这是公开地址，不是凭据；正式值必须符合 GitHub 的账号与仓库命名规则。
3. 重新启动开发服务或构建前端。在源码弹窗检查链接，在反馈页整理一条线索，确认“前往 GitHub 提交”指向该仓库的模板。仅打开表单不会发布 issue。
4. GitHub CI 通过后，可以给验证过的提交创建测试版发布。发布介绍需注明目录覆盖和价格限制。

显式设置 `VITE_REPOSITORY_URL=` 时，源码弹窗隐藏仓库链接，反馈页提供复制和下载。`VITE_` 配置会写入公开前端，不能用于保存凭据。无效或带登录信息的仓库地址会使开发启动/构建失败，并提示修正。

## 部署与上线验证

按 [轻量版部署说明](deployment-lite.md) 创建自己的 D1、导入选定目录、部署 API 与独立静态前端。必须先将同源 `/api/*` 转到 Worker，再应用 SPA 回退；Vite 的代理不会随构建产物自动上线。主机需允许直接访问 `/search`、`/faq`、`/manifesto` 和 `/contribute`。

上线时检查健康接口的目录版本和仓库数量、上述五种搜索情况、中英文、手机布局、源码链接及手动反馈流程。当前没有在线提交后端、搜索统计或自动收录；反馈草稿在本站页面内不持久化，离开页面会丢失未保存内容。

## 后续边界

价格不是实时采购报价，套餐组件不等于完整账单。仍有候选与价格待核验；语义搜索、自动价格更新、审核后台及快照清理未实现。Fork 使用自己的部署账号、目标仓库和域名，分别验证本地运行与云端部署。

## 本轮本地验收

- 在 Windows、Node.js 24 / npm 11 上，从不含依赖、本地数据库和采集集的源码副本执行 `npm ci`，再成功迁移并导入 24 个精选项目。
- 主工作区和干净副本均通过完整 `npm run check`：74 项测试实际执行且全部通过，类型、代码规范、格式、API 预构建及前端构建通过。最后的无障碍标签与样式微调另行通过前端类型、规范、格式与构建检查。
- 干净副本在独立本地端口启动前后端，代理健康接口返回 `curated-only` 和 24 个项目；Bruno 精确搜索返回真实目录记录。
- 浏览器验证桌面、平板和手机布局，中英文、空结果带入、HTTPS 来源校验、草稿预览、复制、Markdown 下载、修改后清除旧预览、键盘关闭弹窗，以及配置前后的源码和反馈链接。未提交任何远程 issue；检查期间未记录浏览器警告或错误。
- 新增配置、页面、贡献模板和文档，无依赖版本、锁文件、数据库结构或采集数据变更。构建工具仅提示 Wrangler 有较新补丁版本，本轮保留已锁定版本。

页面截图：[首页](screenshots/proudlypaid-beta-local.png)、[补充目录](screenshots/release-feedback-desktop.png)、[手机反馈预览](screenshots/release-feedback-mobile.png)。历史截图保留部分旧品牌名称；后续提交仍需验证 GitHub CI 和对应云端部署。
