# 第四批目录补充：设计、聊天与项目管理

研究日期：2026-10-20。目录继续采用 `research-pilot` 状态，符合发布规则的记录通过轻量版 API 提供搜索；并非实时价格或迁移兼容性保证。

## 本批交付

| 指标 | 扩充前 | 扩充后 |
| --- | --- | --- |
| 带许可证范围的项目 | 20 | 23 |
| 产品记录，包含待核验候选 | 31 | 34 |
| 有证据和限制说明的关系 | 40 | 53 |
| 价格及计费观察 | 62 | 72 |
| 完成限定范围分类审阅的产品 | 13 | 20 |
| 可发布的项目—产品关系 | 14 | 32 |
| 至少有一个可发布产品的项目 | 9 | 14 |
| 已核验数字计费组件 | 11 | 15 |

72 条计费观察中，45 条已核验、27 条待核验；“已核验”包含询价和计费模型，只有其中 15 条是数字单价。新增、补充核验和历史事实分别保留日期，不能将本批日期视为所有旧价格均已重新确认。

## 新产品与对应关系

| 产品 | 本次价格结果 | 对应项目 |
| --- | --- | --- |
| [UXPin](https://www.uxpin.com/pricing) | Core 29、Growth 40 USD/席位/月，均为年付折算；Enterprise 询价。额外 AI 额度、税费和定制配置不包含在基础席位费内 | Penpot，依据设计、原型与交付功能重叠推断 |
| [Twist](https://twist.com/pricing) | 页面明确显示 US$6/用户/月，但文本提取未确认选中的付款周期，保持待核验；不进入数字排名 | Zulip，依据频道和线程式讨论功能重叠推断 |
| [Basecamp](https://basecamp.com/pricing) | 当前 Freelancer/Studio/Pro/Unlimited 页面观察值为 25/59/99/299，每账户每月、年付折算；ISO 币种仍待确认，四条都不进入数字排名 | Focalboard、Leantime、OpenProject，限于任务与项目协作 |

闭源分类是限定服务范围的研究判断。UXPin 的[服务条款](https://www.uxpin.com/tos)限制代码复制、修改和逆向，并明确美元费用。Twist 页脚链接跳转至 [Todoist 服务条款](https://www.todoist.com/terms-of-service)，该条款明确包含 Twist/Unlimited，并规定有限使用权与源码获取限制。[37signals 条款](https://37signals.com/policies/terms)明确包含 Basecamp，并限制应用代码复用与服务复制。上述判断均排除另行许可的开源库、SDK 和用户内容。

Basecamp 当前套餐按账户和项目容量分档，不沿用旧的每用户套餐；保留当前套餐标题的精确金额。页面 FAQ 出现的取整金额不另作报价。Twist 单频道访客免费，多频道访客按成员计费；这种配置差异保留在原始记录中。

## 已有候选补齐

| 产品 | 本次新增证据 | 对外行为 |
| --- | --- | --- |
| Slack | [主协议入口](https://slack.com/intl/en-gb/main-services-agreement)、[Slack 补充条款](https://slack.com/intl/en-gb/slack-supplemental-terms)及所引用的 [Salesforce MSA](https://www.salesforce.com/en-us/wp-content/uploads/sites/4/documents/legal/salesforce_MSA.pdf)，限制服务复制、修改与逆向 | 原有 Zulip 关系可以发布；原价格及其旧核验日期保留 |
| Asana | [订阅协议](https://asana.com/terms/subscriber-agreement)中的有限访问与使用限制 | 原有关系可以发布；[价格页](https://asana.com/pricing)补 Starter，复查 Advanced，但 ISO 币种未确认，金额继续隐藏 |
| ClickUp | [服务条款](https://clickup.com/terms)中的逆向限制；[官方计费帮助](https://help.clickup.com/hc/en-us/articles/6303314345623-Upgrade-your-plan)明确 USD | Business 12、Unlimited 7 USD/用户/月，年付；仅基础订阅组件，额外 AI、访客和税费可能另计 |
| Airtable | [ToS](https://www.airtable.com/company/tos)、[MSA](https://www.airtable.com/company/msa)及两者引用的 [AUP](https://www.airtable.com/company/aup)，包含修改、复制、分发及源码获取限制 | Baserow 关系可以发布；保留上批 Team/Business 价格事实及日期 |

Airtable 的部分账户适用 MSA，不能仅用个人 ToS 概括所有套餐。本次同时审阅两条协议路径与共用 AUP；并未将 SDK、扩展或整个公司的代码一起归类。Slack 使用现行主协议入口，没有使用旧的 API 许可替代平台协议。分类审阅不是对所有客户个别合同的结论。

## 新项目与关系

| 项目范围及许可证来源 | 产品关系 | 关系性质 |
| --- | --- | --- |
| [Plane Community：AGPL-3.0](https://github.com/makeplane/plane/blob/master/LICENSE.txt) | Jira Cloud、Linear、monday Work Management、ClickUp | [仓库作者](https://github.com/makeplane/plane)明确提及这些替代目标；monday 分类仍待核验，关系保留而不公开 |
| [Wekan：MIT](https://github.com/wekan/wekan/blob/main/LICENSE) | Trello、Asana、ClickUp | 根据公开看板和任务能力的研究推断，未做迁移实测 |
| [Excalidraw：MIT](https://github.com/excalidraw/excalidraw/blob/master/LICENSE) | Miro | 限于草图、图表和白板协作；不包含 Excalidraw Plus 或所有企业能力 |

新记录限定到各仓库所列的社区代码，企业发行版、第三方依赖和单独许可资源不一并归类。许可证链接仍指向可变分支，后续应补不可变提交引用。原始 66,531 条仓库索引和 README 采集集合均保留；这里新增的是研究覆盖，不代表又采集了三份原始 README。

## 待补内容

1. 确认 Sketch、Asana、Basecamp 等观察值的 ISO 币种，以及 Twist 的选中付款周期。未确认前保留观察，不补造 USD 或年付。
2. 继续核验 Notion、Firebase、monday、Zapier 等候选的具体服务范围，处理 Typeform 的页面价格冲突。
3. 下一批可转向表单、客服和自动化类别，优先增加现有项目真实可用的对应关系。仍不按数量强行匹配。
4. 增加不可变证据引用和独立价格复核流程；更大规模的自动采集、后台更新与语义检索仍待实现。

发现用身份表同步增加 UXPin、Twist、Basecamp，目前为 53 条；仍为 `discovery-only`，不会自动提升新线索的核验状态。Twist 使用大小写敏感名称，减少普通英文单词误匹配；本批未重跑旧线索归并，第三批的 50 条身份及归并统计保留为历史结果。

本批沿用现有 JSON 结构与快照导入流程，无数据库结构、接口、依赖或云端配置变更。上一批记录中的“尚未接入”描述是其历史状态；当前接入和运行说明以仓库 README 为准。
