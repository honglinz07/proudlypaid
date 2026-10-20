# 第三批目录扩充：从 README 线索到官网事实

研究日期：2026-10-19。当前目录仍为 `research-pilot`，未接入前端或在线搜索。

## 本批交付

| 项目 | 扩充前 | 扩充后 |
| --- | --- | --- |
| 带范围说明的开源项目记录 | 6 | 20 |
| 产品研究记录，含待核验候选 | 12 | 31 |
| 有公开证据及限制说明的关系 | 12 | 40 |
| 价格/计费观察 | 23 | 62 |

增加 Baserow、Activepieces、AFFiNE、Focalboard、Leantime、OpenProject、Hoppscotch、Formbricks、Chatwoot、Appsmith、Coolify、Dokploy、Keycloak 和 Meilisearch 的限定范围记录。原始采集集合和旧目录事实均保留；没有把企业版或单独的商业模块一并宣称为开源。

新增的产品研究包括 Airtable、Trello、Asana、Jira Cloud、Linear、Miro、Zapier、Typeform、Postman、Auth0、Algolia、Retool、Intercom、Zendesk、ClickUp、monday Work Management、Vercel、Netlify 和 Heroku。

## 名称归并结果

增加 `product-identities.json` 和 `npm run catalog:group`。50 条身份配置仅提供品牌、别名、官网/价格页入口与匹配策略，不代表 50 个已核验的付费闭源产品。

完整处理上一轮 4,678 条文字线索：

- 259 条匹配到已知身份，组成 44 个产品名称组。
- 多产品句子分别进入相关组，形成 427 个产品—证据引用。
- 4,419 条未匹配线索原样保留在 `unresolved.jsonl`。
- 合并后的两类输出覆盖全部 4,678 个原始证据 ID，没有删去未识别内容。

本次运行产物在本地 `.local/catalog-review/run-VNUqOY/`；内容包含第三方 README 短片段，保持 Git 忽略。`report.json` 保存原输入及身份表的 SHA-256，便于复核。输入文件变更后，应明确选择新文件重新运行，而不是继续引用这次统计。

名称匹配始终只产生 `needs-review` 队列。完整原文可用于判断该句是在介绍当前项目、某个目录条目、赞助商，还是尚未实现的设想。只有人工审阅后的关系写入 `pilot.json`。部分作者声明关联了 `discoveryEvidenceIds`，并核对证据确实来自该项目的仓库；其他关系明确标记为公开功能重叠判断。

## 代表性关系与实际限制

| 项目范围 | 产品候选 | 证据与限制 |
| --- | --- | --- |
| Baserow Community | Airtable | [项目作者说明](https://github.com/baserow/baserow)；不包含 Baserow premium/enterprise 功能 |
| Activepieces Community | Zapier | [作者声明与许可范围](https://github.com/activepieces/activepieces)；连接器、执行方式和任务计费不同 |
| AFFiNE Community | Notion、Miro | [作者定位](https://github.com/toeverything/AFFiNE)；文档、白板和数据模型只存在部分功能重叠 |
| Focalboard standalone | Trello、Notion、Asana | [作者定位及维护提示](https://github.com/mattermost-community/focalboard)；源构建许可有例外，官方编译物使用其他条款，仓库当前不维护 |
| Leantime core / OpenProject Community | Asana、ClickUp、monday / Jira 等 | 分别对照[Leantime](https://github.com/Leantime/leantime)、[OpenProject](https://github.com/opf/openproject)；项目规划、问题跟踪与企业套装不可视为完全等价 |
| Hoppscotch Community | Postman | [官方项目定位](https://github.com/hoppscotch/hoppscotch)；脚本、监控及协作功能需单独评估 |
| Formbricks Core | Typeform | [核心及企业版边界](https://github.com/formbricks/formbricks)；关系为调查问卷功能的研究判断 |
| Chatwoot Community | Intercom、Zendesk | [作者定位](https://github.com/chatwoot/chatwoot)；AI、渠道、客服席位和企业能力单独核对 |
| Appsmith Community | Retool | [项目公开能力](https://github.com/appsmithorg/appsmith)与[Retool 套餐](https://retool.com/pricing)；创建者、内部用户和外部用户计费不同 |
| Coolify / Dokploy 社区组件 | Vercel、Netlify、Heroku | [Coolify](https://github.com/coollabsio/coolify)、[Dokploy](https://github.com/Dokploy/dokploy)；自管服务器和托管平台的资源模型不同，Dokploy 的 proprietary 内容明确排除 |
| Keycloak / Meilisearch Community | Auth0 / Algolia | [Keycloak](https://github.com/keycloak/keycloak)、[Meilisearch](https://github.com/meilisearch/meilisearch)的公开能力；身份服务和搜索引擎的操作、配额及商业功能需分别评估 |

这些记录不能作为完整迁移兼容性保证。可变分支链接仍是本次研究入口，正式发布数据集前应补充适用的不可变源码引用。

## 价格和闭源属性的实际进度

31 个产品中，13 个有明确范围的官方来源分类审阅，18 个仍待核验。分类结论是基于所列官方材料的研究判断，不覆盖整个公司的所有代码或产品。

62 条计费观察包含：31 条数字观察、20 条询价、9 条按量模型和 2 条本次未可靠取得价格。核验状态为 40 条已核验的价格/询价/计费模型、22 条待核验。**其中只有 11 条是已核验的具体数字价，分布于 8 个产品**；价格核验与产品闭源分类核验独立，尚未建立可横向比较的完整场景报价。

本批新确认的数字组件包括 Airtable Team/Business、Trello Standard/Premium、Linear Business。币种另外参考了 [Airtable 付款条款](https://www.airtable.com/company/tos)和[Linear 费用条款](https://linear.app/terms)；其余只出现 `$` 而未完成币种复核的观察，继续标记待审，不强行补成 USD。

几项实际发现：

- [Postman](https://www.postman.com/pricing/) 现有 Team 套餐；Basic 和 Professional 已不面向新客户销售，未沿用旧套餐表。
- [Typeform](https://www.typeform.com/pricing) 顶部卡片和比较区有不同数字；保留带来源的观察并标记冲突，暂不进入排名。
- [monday](https://monday.com/pricing) 同页包含多个产品与人数计算器；未把 CRM/Service 数字写成 Work Management 报价。
- [Intercom](https://www.intercom.com/pricing) 把席位与使用量结合；Expert 席位组件不等于完整客服账单。
- [Netlify](https://www.netlify.com/pricing/) 当前 Pro 使用额度分档，包含无限成员；没有沿用旧的每开发者席位模型。
- [Vercel](https://vercel.com/pricing) 和 [Heroku](https://www.heroku.com/pricing/) 的资源和附加服务影响总费用，保留单独的按量模型。

## 下一批工作

1. 继续核验已归并产品组里的项目归属，补齐确实相关的项目与关系；优先处理已有作者声明的组。
2. 补 Typeform 冲突、monday 计算器、各产品币种与账期的具体复核任务；不以数量为由提升状态。
3. 完成剩余产品的作用范围分类，再定义设计、聊天、表单等类别的比较场景。
4. 候选归并和目录形成可重复流程后，接入 Workers 名称搜索；向量版继续使用相同目录与稳定 ID。

此前提出的 50 个产品、100 组关系仍是后续里程碑；当前研究目录的实际数量为 31/40。SQL 数据库、网页定向采集器、后台更新及网页接入尚未实现。
