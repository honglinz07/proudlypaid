# 搜索引擎发现与收录

[English](search-discovery.md) | **简体中文**

生产构建会在构建时把现有 React 页面渲染为静态 HTML。抓取程序直接取得与用户看到的相同英文正文，无需执行 JavaScript 就能读取首页、FAQ 和宣言页。浏览器随后启动交互应用，使用已保存的语言偏好并提供实时搜索。静态渲染不调用 API、不读取目录，也不写入 D1。

## 已配置内容

- 分页标题、描述、规范网址，以及 Open Graph 和 Twitter 分享摘要。
- 首页 `WebSite` JSON-LD，使用真实站点名称和规范首页，不伪造评价或价格。
- `/sitemap.xml` 仅列出 `/`、`/faq`、`/manifesto`，不编造修改日期，不包含搜索查询或反馈表单。
- `/robots.txt` 声明站点地图，并要求抓取程序避开 `/api`。搜索页允许抓取，以便读取 `noindex, follow` 指令。
- 搜索、反馈和不存在的页面使用 `noindex, follow`。未知生产网址返回自定义 `404.html` 和 HTTP 404；未知 API 仍返回 JSON 404。

规范站点地址为 `https://www.proudlypaid.com`。两个已绑定域名都声明这一规范地址，没有新增根域名到 www 的跳转。Fork 应将公开构建变量 `VITE_SITE_URL` 改成自己的 HTTPS 站点地址，不包含凭据、路径、查询参数或片段。此值用于规范网址、结构化数据和发现文件，修改后重新构建。参见 `apps/web/.env.example`。

静态 HTML 使用英文。中文界面目前与英文共用网址，通过浏览器偏好切换，没有单独的中文落地页网址，也不声明不存在的 `hreflang` 地址。

## 部署与验证

运行 `npm run check`，再按 [Cloudflare 指南](deployment-cloudflare.zh-CN.md)发布代码。生产资源配置将目录首页以不带结尾斜杠的网址提供，未知地址使用最近的自定义 404 页面。使用独立静态主机时，应提供各路由对应的 HTML，保留 `/search` 查询参数，并对未知页面返回 `404.html` 和 404 状态。先把 `/api` 和 `/api/*` 转发到 API，再处理静态页面。

检查公开首页、`/faq`、`/robots.txt` 和 `/sitemap.xml`。在原始 HTML 中确认真实正文和对应页面的元信息；确认不存在的网址返回 404，`/search?q=Penpot` 仍可交互，站点地图不含搜索页。部署代码不需要重新导入数据库。

## Search Console

站点文件使抓取成为可能，不会代为注册 Google 账号，也不保证收录。在自己的 [Google Search Console](https://search.google.com/search-console/) 中：

1. 添加 `proudlypaid.com` 网域资源，或 `https://www.proudlypaid.com/` 网址前缀资源。
2. 按该资源提供的方式完成[所有权验证](https://support.google.com/webmasters/answer/9008080)。网域资源需要添加 DNS 验证记录，保留现有网站与邮箱记录。
3. 在站点地图中提交 `https://www.proudlypaid.com/sitemap.xml`。
4. 检查首页网址，执行实时测试并申请编入索引。Google 处理网站期间，查看报告中的抓取与收录问题。

仓库不会自动创建 Search Console 资源、验证令牌或提交请求。不要把账号凭据放入前端环境变量。抓取、收录时间和展示由 Google 决定，满足技术条件不代表保证排名或收录。

参考：[Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)、[站点名称](https://developers.google.com/search/docs/appearance/site-names)、[站点地图](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)、[Google 搜索工作原理](https://developers.google.com/search/docs/fundamentals/how-search-works/)。
