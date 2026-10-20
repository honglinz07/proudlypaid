import { Link } from "react-router";
import { Icon } from "../components/Icon";
import { useLocale } from "../lib/locale";

export function FaqPage() {
  const { t } = useLocale();
  const questions = [
    {
      question: t(
        "Why does my project have no recommendations yet?",
        "为什么搜到项目，却没有推荐？",
      ),
      answer: t(
        "This is a beta with a small curated catalog. Repository indexing and reviewed recommendations are separate. Some projects have no suitable match; others await research. You can request coverage or submit official evidence through Contribute. Every lead is reviewed before publication. Even our invoices require paperwork.",
        "这是使用精选目录的测试版。仓库索引和已核验推荐是两回事；有些项目尚未研究，有些暂时没有合适的对应关系。可以通过“补充目录”申请收录或提供官方资料。线索核验后才会展示，毕竟账单也需要手续。",
      ),
    },
    {
      question: t(
        "Why are the most expensive products listed first?",
        "为什么最贵的产品排在最前面？",
      ),
      answer: t(
        "We believe your time is valuable. Verified unit prices sort highest first within each currency, unit, period and billing cycle. Configurations still differ, and a component is not a complete bill. Quotes and usage models remain separate. Even we have standards.",
        "我们相信您的时间很宝贵。已核验单价按币种、单位、展示周期和付款周期分别降序排列。配置仍可能不同，单项费用也不是完整账单。询价和用量模型单独展示。即使是我们，也有原则。",
      ),
    },
    {
      question: t(
        "What if I’m happy with my open-source software?",
        "如果我对现在的开源软件很满意呢？",
      ),
      answer: t(
        "Recognizing the problem is often the hardest step. Take your time. Your budget isn’t going anywhere, which is precisely our concern.",
        "意识到问题，往往是最艰难的一步。慢慢来。您的预算又不会自己花掉，而这恰恰是我们所担心的。",
      ),
    },
    {
      question: t("Are these real products and prices?", "这些产品和价格是真的吗？"),
      answer: t(
        "Search now uses an actual repository index and a small researched catalog. Product classifications are scoped research judgments with official evidence. Price observations have sources, configurations and review dates; they are not live quotes. Pending product classifications and unverified amounts are withheld. No affiliation or endorsement is implied.",
        "目前搜索使用真实仓库索引和小规模研究目录。产品分类是限定范围、附有官方资料的研究判断；价格保留来源、配置和核验日期，并非实时报价。待核验的产品分类及未确认金额暂不展示，不表示合作或背书。",
      ),
    },
    {
      question: t("Can I see the source code?", "我能看看源码吗？"),
      answer: t(
        "We appreciate your curiosity and have forwarded it to the appropriate department. The department has reluctantly confirmed: yes. This entire project is open source under the MIT license. Frontend, backend, and original assets included. The contradiction is a core feature.",
        "感谢您的好奇心，我们已将其转交相关部门。相关部门勉强确认：能。整个项目采用 MIT 许可证完全开源，包括前端、后端和原创素材。自相矛盾是我们的核心功能。",
      ),
    },
    {
      question: t("Does more expensive mean better?", "更贵就代表更好吗？"),
      answer: t(
        "It means more expensive. We have been remarkably consistent about this. Price ranking is a joke, not a quality score or purchasing recommendation.",
        "代表更贵。对此，我们的立场始终如一。价格排序是这个网站的笑点，不是质量评分或采购建议。",
      ),
    },
    {
      question: t("What do you do with my search history?", "你们会如何处理我的搜索记录？"),
      answer: t(
        "Search terms appear in the address bar and are sent to our API. The application does not store search history or add analytics; hosting and proxy logs depend on deployment configuration. Contribution drafts stay in your browser until you copy, download or submit them yourself on GitHub. Your language preference is saved locally. We are deeply disappointed by this missed monetization opportunity.",
        "关键词会出现在地址栏，并发送到我们的 API。应用不保存搜索历史，也没有统计追踪；托管平台及代理日志取决于部署配置。补充线索的草稿在浏览器中整理，由您自行复制、下载或到 GitHub 提交。语言偏好保存在本地。我们对错失这一变现机会深感遗憾。",
      ),
    },
    {
      question: t("Do I have to pay to use proudlypaid?", "使用 proudlypaid 需要付费吗？"),
      answer: t(
        "No. We provide this service completely free of charge. Please allow us some privacy during this difficult admission.",
        "不需要。我们完全免费提供这项服务。在承认这件事的艰难时刻，请给我们留一点私人空间。",
      ),
    },
  ];
  return (
    <section className="reading-page container">
      <div className="page-intro">
        <span className="eyebrow">
          {t("CUSTOMER SUCCESS, WITHOUT THE CUSTOMER", "没有客户，也要做好客户成功")}
        </span>
        <h1>
          {t("Frequently avoided", "经常回避的")}
          <br />
          <span className="serif">{t("questions.", "常见问题。")}</span>
        </h1>
        <p>
          {t(
            "You have questions. Our legal department has approved these answers.",
            "您有疑问。我们的法务部门已批准以下答复。",
          )}
        </p>
      </div>
      <div className="faq-list">
        {questions.map((item, index) => (
          <details key={item.question} className="faq-item" open={index === 0}>
            <summary>
              <span className="faq-number">0{index + 1}</span>
              <h2>{item.question}</h2>
              <span className="faq-plus" aria-hidden="true">
                +
              </span>
            </summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
      <div className="faq-bottom">
        <Icon name="lock" size={20} />
        <p>
          {t(
            "Still have questions? Some things are proprietary.",
            "还有疑问？有些事情属于商业机密。",
          )}
        </p>
        <Link className="text-link" to="/contribute">
          {t("Help improve the directory", "帮助补充目录")}
          <Icon name="arrow" size={16} />
        </Link>
      </div>
    </section>
  );
}
