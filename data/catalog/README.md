# 研究目录与采集记录

首批日期：**2026-10-17**；最近扩充：**2026-10-21**。本目录的原创研究摘要采用仓库的 MIT 许可证。轻量版搜索已通过 D1 快照接入其中符合发布规则的记录；候选和未核验金额不自动公开。各条记录保留自己的核验日期。

当前累计 **24 个项目、41 个产品、61 组关系、96 条计费观察**。31 个产品完成限定范围的官方分类审阅，可发布的 44 组关系覆盖 19 个项目；27 条数字计费组件已核验。本次按自动化、表单、客服和内部应用四组补入 7 个产品，其他候选按缺少官网、采集受阻和证据待审分组保留。见 [批量证据审阅记录](batches/2026-10-21-bulk-review.md)；后文统计保留历史时点。

本次试验从 [OpenAlternative](https://openalternative.co/) 的替代关系页面发现候选，再查看项目仓库、许可证和产品官网。其维护者的 [公开清单](https://github.com/piotrkulpinski/open-source-alternatives)标注 CC0-1.0，可作为后续发现入口。本次没有批量复制清单、产品描述、图片或评论；文件中的描述为自行撰写的核验摘要。

## 2026-10-17 首批结果

| 开源项目 | 候选产品 | 对应关系证据 | 价格采集结果 |
| --- | --- | --- | --- |
| [AppFlowy](https://github.com/AppFlowy-IO/AppFlowy) | [Notion](https://www.notion.com/pricing) | 作者明确定位为 Notion 替代品 | 页面显示 Business **EUR 19.50 / 成员 / 月**；年付/月付选中状态待确认。Enterprise 需询价 |
| [Penpot](https://github.com/penpot/penpot) | [Figma](https://www.figma.com/pricing/) | 目录发现，人工审阅设计与原型功能重叠 | Enterprise **Full seat USD 90 / 月，年付**；不同席位类型不可混用 |
| [Zulip](https://github.com/zulip/zulip) | [Slack](https://slack.com/pricing) | 目录发现，人工审阅团队聊天功能重叠 | Business+ **USD 15 / 用户 / 月，年付**；Enterprise+ 需询价 |
| [Uptime Kuma](https://github.com/louislam/uptime-kuma) | [UptimeRobot](https://uptimerobot.com/pricing/) | 目录发现，人工审阅检查、告警与状态页功能重叠 | 主价格页显示 Scale 200 monitors **$65 / 月、$780 / 年**，但另一个官方页面索引显示 $79 / 月；保留为待核验观察值 |
| [Supabase](https://github.com/supabase/supabase) | [Firebase](https://firebase.google.com/pricing) | 作者描述 Firebase-like 功能，同时声明并非一一对应 | Blaze 按服务和用量收费，尚无可比较的月度总额 |
| [Grafana OSS](https://github.com/grafana/grafana) | [Datadog](https://www.datadoghq.com/pricing/list/) | 目录发现，人工审阅部分监控功能重叠 | Infrastructure Enterprise **USD 23 / 主机 / 月，年付**；仅代表一个 SKU |

所有价格对应具体配置，并不表示整个产品“最高价”。以上行是采集摘要，不是价格排行榜。价格原始来源、配置、核验日期、限制及许可证来源均在 [pilot.json](pilot.json) 中。

6 个项目、6 个候选产品、6 组关系；3 条明确的数字价、3 条询价记录、1 条按量模型，以及 2 条待核验的观察值。数字价核验与闭源属性核验是两个独立状态。

## 这次发现的实际问题

1. **目录适合发现候选关系。** AppFlowy 和 Supabase 的定位还能由作者自己的仓库佐证；其余关系是根据公开能力作出的人工判断，没有进行迁移实测。
2. **付费不等于闭源，知识产权归属也不足以单独证明闭源。** 本批 Figma、Datadog 的平台限制条款已审阅，闭源分类为带明确范围的研究判断。Notion、Slack、UptimeRobot、Firebase 仍保留 `needs-review`，不冒充官方核验完成。SDK、代理和扩展可能采用独立的开源许可。
3. **价格最容易丢失上下文。** 币种、地区、年付折算、促销、席位类型、监控数量、附加组件，都应保留。Notion 的抓取结果是 EUR，不能直接写成 USD；Slack 的短期促销没有当作常规价格。
4. **同类功能不等于完整互换。** 例如 Grafana OSS 不能直接等同于整个可观测性部署，Datadog 的单项主机费也不等于总账单。
5. **同一官网也可能出现不同报价。** UptimeRobot 的主页面与一个带查询参数的官方页面索引显示了不同的 Scale 年付折算价。数据同时保留两条来源，标记待核验；不能仅凭其中一个数字就宣布价格确认完成。

## 数据约定

`pilot.json` 分为 `projects`、`products`、`relationships`，通过 ID 连接，便于后续扩成多对多关系。

- 项目、产品、闭源分类、关系和价格各有 `reviewedOn`，必须是有效日期且不晚于目录顶层日期。顶层日期表示最近研究批次，不会刷新旧条目的事实。
- 项目许可证只描述 `scope` 指定的仓库／组件。可变分支链接记录的是本次观察；正式发布前应补不可变提交引用。AGPL 标签不擅自细化为 only/or-later。
- `sourceAvailability.verification`：`official-reviewed` 为已审阅官方证据的研究判断；`needs-review` 为尚未完成分类核验的候选。已审阅分类区分 `proprietary-hosted-service` 与 `proprietary-software`；两者都不等于全公司所有代码的分类。
- 关系的 `author-claimed` 是作者明确定位；`feature-overlap-reviewed` 是根据列出的公开能力作出的人工推断。`limitations` 必填。
- `pricing.verification`：`verified` 表示本次确认该条价格／询价／计费模型；`needs-review` 允许保留不完整的观察值，不能用于排名。
- `list-price` 保留币种、原始计费单位、展示周期、实际付款周期和配置。只有币种符号时允许 `currency: null` 配合 `currencySymbol`，但只能为 `needs-review`。
- `contact-sales`、`usage-based`、`unavailable` 的 `amount` 为 `null`，不能填零。`unavailable` 表示这次未能可靠取得价格，不等于询价套餐，也不能标为已核验。
- 所有记录都必须保留来源 URL。原始来源会变化，正式使用前需要重新核验。可选 `currencyEvidenceUrl` 补充币种来源；关系的 `discoveryEvidenceIds` 对应本地发现队列中的证据 ID，不代表自动核验。

## 本地检查

```bash
npm run catalog:check
npm run test:catalog
```

检查 ID、引用、来源链接、核验状态以及缺价/计费语义；它不会联网，也不能替代人工事实核验。完整项目检查 `npm run check` 同时覆盖这些数据检查与回归用例。

## 2026-10-19 扩充批次

新增 6 个产品与 6 组关系，总计 **6 个项目、12 个产品、12 组关系**。项目、关系、价格和闭源范围是独立的核验维度。

| 开源项目 | 新增候选 | 官方资料及本轮结果 |
| --- | --- | --- |
| AppFlowy | Confluence Cloud | [价格页](https://www.atlassian.com/en/software/confluence/pricing)；Premium 观察到美元符号和 11.16/用户/月，但币种与计算器配置待确认；Enterprise 询价。闭源判断限定 Cloud 平台 |
| Penpot | Sketch | [价格页](https://www.sketch.com/pricing/)；Standard/Professional/Enterprise 年付折算每编辑每月观察值 12/24/44，ISO 币种尚未确认，均不参与排名。原生编辑器要求 Mac；Private Cloud 询价 |
| Zulip | Microsoft Teams | [美国价格页](https://www.microsoft.com/en-us/microsoft-teams/compare-microsoft-teams-business-options)；Essentials USD 4/用户/月、含 Teams 的 Business Basic USD 7/用户/月，均年付；后者为更大范围的服务套装 |
| Uptime Kuma | Pingdom | [价格页](https://www.pingdom.com/pricing/)；Synthetic Monitoring 计算器数字未被文本提取，记为 `unavailable`；Enterprise 明确询价 |
| Grafana OSS | New Relic | [价格页](https://newrelic.com/pricing)；Pro full-platform user 年付 USD 349/用户/月只是一个席位组件；完整账单另含数据、计算或附加项 |
| Grafana OSS | Dynatrace | [价格页](https://www.dynatrace.com/pricing/)；主机/内存按小时计费，保留按量模型；适用订阅协议的闭源属性核验仍待完成 |

以上关系为对公开功能重叠的研究判断，未作迁移实测。旧批次记录仍保留 2026-10-17 的日期和原核验状态，没有冒充本轮重新核验。Supabase 的第二个候选仍待补充。

累计 23 条价格观察：12 条数字观察、6 条询价、4 条按量模型、1 条本次未取得价格。其中 **6 条数字价为已核验的具体计费组件**，6 条数字观察和 1 条未取得价格记录待核验；不能据此宣称已有全局可比排行榜。12 个产品中，7 个有明确作用范围的官方分类审阅，5 个仍是候选。

## 扩充工具与后续顺序

执行 `npm run catalog:discover` 可离线扫描全部已采集 README，提取明确的替代声明。每次写入新的 `.local/catalog-discovery/run-*/`，保留证据行号与 README 哈希，输出候选、错误和扫描统计；候选不会自动写入本目录，也不会被当作付费闭源产品。

本轮已实际扫描索引中的 **66,531 个仓库**，读取 **66,323 份 README**，另有 **208 条无本地 README 引用**；从 2,816 个仓库提取 **4,678 条待核验文字线索**，扫描错误为 0。线索包含重复产品、开源软件和其他比较，尚未完成产品归并。扫描完成状态只描述这次本地文件处理；GitHub 原始采集报告中的未决问题仍单独保留。

完整的信息来源、候选审核、价格采集、更新策略与两版后端接入顺序见 [目录扩充方案](../../docs/catalog-expansion-plan.md)。D1 数据库、SQL 快照导入和名称搜索已实现，运行 `npm run db:local` 即可导入；网页定向提取、后台更新和语义搜索仍待实现。发布规则与计费组件分组见 [架构说明](../../docs/architecture.md)。

## 第三批：名称归并与官网核验

目录现为 **20 个项目、31 个产品、40 组关系、62 条计费观察**。新增 14 个项目范围记录和 19 个产品研究记录；其中 13 个产品完成有明确范围的官方分类审阅，18 个仍待核验。11 条已核验数字价分布于 8 个产品，其余记录包含询价、用量模型或待审观察，尚不构成全局可比较排行榜。

`product-identities.json` 提供 50 个发现用身份与官网/价格页入口；其 `discovery-only` 状态不等于核验完成。运行 `npm run catalog:group -- --input .local/catalog-discovery/run-QuXspR/candidates.jsonl`，可将指定发现批次归并到新的 `.local/catalog-review/run-*/`；未识别线索原样保存，默认不自动挑选上次运行。

本批 4,678 条线索中，259 条匹配为 44 个产品名称组，4,419 条继续待识别。原始证据全部保留，匹配不会自动提升许可、价格或替代关系状态。结果、具体关系与剩余工作见 [第三批扩充记录](batches/2026-10-19-expansion.md)。
