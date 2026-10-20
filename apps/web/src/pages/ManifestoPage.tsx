import { Link } from "react-router";
import { BrandMark, Icon } from "../components/Icon";
import { useLocale } from "../lib/locale";

export function ManifestoPage() {
  const { t } = useLocale();
  const principles = [
    {
      title: t("Freedom is an operational overhead.", "自由，是一种运营负担。"),
      body: t(
        "Choosing where to host. Reading the source. Leaving when you want. These are decisions. Decisions take time. A sufficiently restrictive license can eliminate all three.",
        "选择托管位置、阅读源代码、随时离开。这些都是决策。决策需要时间。而一份限制足够严格的许可证，可以一次消除这三个问题。",
      ),
    },
    {
      title: t("A recurring payment is a lasting relationship.", "持续扣款，是最长情的陪伴。"),
      body: t(
        "Open-source maintainers may thank you for a contribution. A proprietary vendor will email you every single month. That’s the kind of consistency modern businesses deserve.",
        "开源维护者可能会感谢您的贡献。闭源供应商则会每个月都给您发邮件。这才是现代企业值得拥有的稳定关系。",
      ),
    },
    {
      title: t("The price is the feature.", "价格本身，就是一项功能。"),
      body: t(
        "A tool that works for free is useful. A tool that requires budget approval is strategic. We help you find software your finance department will finally notice.",
        "免费好用的工具，叫实用。需要预算审批的工具，叫战略。我们帮助您找到终于能引起财务部门注意的软件。",
      ),
    },
    {
      title: t("Some contradictions are worth sharing.", "有些矛盾，值得公开分享。"),
      body: t(
        "We built a closed-source directory with open-source software and released all of its code under MIT. You can read it, change it, self-host it, and leave whenever you like. We understand how this looks.",
        "我们用开源软件做了一个闭源目录，又把全部代码以 MIT 许可证开源了。您可以阅读、修改、自行部署，并随时离开。我们明白，这看起来有点尴尬。",
      ),
    },
  ];
  return (
    <section className="reading-page manifesto-page container">
      <div className="page-intro">
        <span className="eyebrow">
          {t("THE CLOSEDSOURCES MANIFESTO", "CLOSEDSOURCES 闭源宣言")}
        </span>
        <h1>
          {t("Progress has", "进步，理应")}
          <br />
          <span className="serif">{t("a price tag.", "明码标价。")}</span>
        </h1>
        <p>
          {t(
            "An entirely serious position on an entirely avoidable expense.",
            "以绝对认真的立场，面对完全可以避免的支出。",
          )}
        </p>
      </div>
      <div className="manifesto-lead">
        <BrandMark large />
        <p>
          {t(
            "For too long, software has been available to anyone. To inspect. To improve. To use without a quarterly business review. We asked ourselves: what if it wasn’t?",
            "长久以来，软件竟然人人可用。可以审查，可以改进，甚至不需要季度业务回顾就能使用。我们不禁思考：如果不让呢？",
          )}
        </p>
      </div>
      <div className="manifesto-principles">
        {principles.map((principle, index) => (
          <article key={principle.title}>
            <span className="principle-number">0{index + 1}</span>
            <div>
              <h2>{principle.title}</h2>
              <p>{principle.body}</p>
            </div>
          </article>
        ))}
      </div>
      <div className="manifesto-signoff">
        <span className="eyebrow">
          {t("A NOTE FROM THE DEPARTMENT OF TRANSPARENCY", "透明度管理部门特别说明")}
        </span>
        <p>
          {t(
            "This is satire, made with affection for open source. No real vendors were invoiced in the making of this website.",
            "这是一个出于对开源的热爱而制作的讽刺网站。制作过程中，没有向任何真实供应商开具发票。",
          )}
        </p>
        <Link className="button button-primary" to="/">
          {t("Find something to pay for", "找点值得付费的东西")}
          <Icon name="arrow" size={17} />
        </Link>
      </div>
    </section>
  );
}
