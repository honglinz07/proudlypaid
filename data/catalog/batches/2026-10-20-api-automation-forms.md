# 第五批目录补齐：API、自动化与表单

研究日期：2026-10-20。目标是让已有热门项目的候选完成服务范围和计费核验，进入轻量版搜索。未创建 GitHub 远程仓库或云端部署。

## 实际变化

| 指标 | 本批前 | 本批后 |
| --- | --- | --- |
| 带许可证范围的项目记录 | 23 | 24 |
| 产品记录，含待审候选 | 34 | 34 |
| 研究关系 | 53 | 54 |
| 完成限定范围分类审阅的产品 | 20 | 24 |
| 可发布关系 | 32 | 37 |
| 至少有一个可发布推荐的项目 | 14 | 19 |
| 价格及计费观察 | 72 | 79 |
| 已核验数字组件 | 15 | 21 |

本批补齐的是四个已有产品，不将其重复计为新产品。79 条计费观察中，53 条已核验、26 条待审；已核验包含询价和按量模型，只有 21 条为数字组件。原有项目、产品和关系 ID 全部保留，原始 66,531 条仓库索引和 README 不变。

## 可以展示的对应关系

- Hoppscotch Community → Postman。
- Activepieces Community → Zapier。
- Formbricks Core → Typeform。
- Appsmith Community → Retool。
- 新增 Bruno Community → Postman。

原有四组关系沿用各自功能证据和研究日期。本次补齐产品范围核验，不将旧功能判断冒充本日重新测试。所有关系都保留限制说明，不保证完整迁移兼容性。

## 服务范围证据

| 产品 | 官方证据 | 本批研究判断 |
| --- | --- | --- |
| Postman | [2026-06-08 服务条款](https://www.postman.com/legal/terms/)、[所引用的 AUP](https://www.postman.com/legal/postman-acceptable-use-policy/) | 有限订阅及可执行代码使用权，配合源码获取与转售限制，支持对付费 API 平台的限定分类；单独的 OSS、SDK、Newman 和客户内容不纳入 |
| Zapier | [2026-04-09 服务条款](https://zapier.com/legal/terms-of-service) | 定义云端自动化服务，并在第 4 节限制逆向、修改和再分发；不将所有连接器或 SDK 一并归类 |
| Typeform | [服务条款](https://www.typeform.com/legal/service-terms-and-conditions) | 第 2(c) 节为有限订阅访问，第 3(b) 节限制逆向与服务复制；仅针对托管表单服务 |
| Retool | [客户条款](https://docs.retool.com/legal/customer-terms-of-service)、[MSA](https://docs.retool.com/legal/master-subscription-agreement) | 有限目标代码使用权及第 3.3 节的平台修改、逆向限制；本目录分类限定 Retool 托管平台，排除客户应用、数据和独立许可组件 |

分类为依据所列证据的研究判断，适用范围和个别协商合同仍需分别核对。付费本身不作为闭源证据。

## 价格核验结果

### Postman

[当前价格页](https://www.postman.com/pricing/)确认 Solo 为 9/账户/月、Team 为 19/用户/月，均年付折算；[费用条款](https://www.postman.com/legal/terms/)第 7.1 节明确美元，故记录 USD。两种单位分别建组，不把个人套餐当团队席位。

价格是基础订阅组件；AI 额度外消费和安全附加项可能另计，另外补充按量记录。Enterprise 旧询价观察保留原日期。本次没有恢复已退出新客户销售的 Basic/Professional 套餐。

### Retool

[欧洲地区价格页](https://retool.com/en-EU/pricing?path=pricing)明确使用欧元符号，标注年付；新增以下 EUR 组件：

| 套餐 | Builder/月 | Internal user/月 |
| --- | --- | --- |
| Team | 9 | 5 |
| Business | 46 | 14 |

这是地区页面的欧元报价，不是从美元换算的值。Builder 和内部用户分别建组；其他角色、用量和税费需另算，不构成完整团队预算。旧的美元符号观察值仍保留待核验状态和原日期，没有用欧元记录覆盖它们。

### Zapier

[价格页](https://zapier.com/pricing)的币种选择明确为 USD，但未可靠确认 Professional 起价对应的任务档位和选中账期，原数字继续待核验、不进入排序。[官方额外任务计费说明](https://help.zapier.com/hc/en-us/articles/15279018245901-How-pay-per-task-billing-works-in-Zapier)确认存在按量超额模型，费率取决于套餐及账期，新增 `usage-based` 记录，金额为 null。

没有将帮助文档里的 750 任务示例强行关联到价格页的起价；套餐功能、币种确认与完整价格配置是不同事实。

### Typeform

[价格页](https://www.typeform.com/pricing)仍同时出现多组 Basic 数字；[Basic 官方帮助](https://help.typeform.com/hc/en-us/articles/360060585211-Basic-plan)明确说明目前存在定价实验，页面与账号可能不同。因此本次确认了冲突原因，但未确定具体适用报价，原观察继续待核验。Enterprise 询价可以显示，不造出一个“统一现价”。

## Bruno 的新增范围

[项目仓库](https://github.com/usebruno/bruno)明确将自身定位为 Postman 等 API 客户端的替代品；[代码许可证](https://github.com/usebruno/bruno/blob/main/license.md)为 MIT。新增记录限定社区代码，排除商业版本、独立许可依赖，以及 README 明确标注另有 CC BY-SA 4.0 许可的 OpenMoji 衍生标志。没有复制标志资产或整份 README 进入公开研究目录。

## 接入与剩余工作

沿用既有 JSON 合约、D1 快照、筛选和分组规则，无运行时代码、结构迁移或依赖变更。新增回归检查覆盖美元账户/用户分组、欧元角色分组，以及产品可展示时未核验金额仍需隐藏的情况。

剩余重点是 Zapier 的确切任务/账期配置、Typeform 实验报价归属、Retool 旧美元观察值的币种，以及上一批的 Sketch、Asana、Basecamp 和 Twist 待审价格。目录仍为 `research-pilot`，未实现自动价格更新或语义检索。
