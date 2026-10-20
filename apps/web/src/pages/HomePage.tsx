import { Link } from "react-router";
import { Icon } from "../components/Icon";
import { SearchBox } from "../components/SearchBox";
import { useLocale } from "../lib/locale";

export function HomePage() {
  const { t } = useLocale();
  return (
    <>
      <section className="hero container">
        <div className="hero-eyebrow">
          <span className="status-dot" />
          {t("THE FUTURE IS CLOSED", "未来，理应闭源")}
          <span className="eyebrow-divider" />
          <span>{t("A more expensive way forward", "通往未来，更贵的方式")}</span>
        </div>
        <h1>
          {t("Tired of having", "是否厌倦了")}
          <br />
          <span className="hero-serif">
            {t("too much money?", "钱太多的生活？")}
            <span className="asterisk" aria-hidden="true">
              ✳
            </span>
          </span>
        </h1>
        <p className="hero-description">
          {t(
            "Open source has saved you enough. Discover premium, closed-source",
            "开源软件已经帮您省得够多了。寻找优质的闭源替代品，",
          )}
          <br className="desktop-break" />
          {t(
            " alternatives to the tools you love. Bring back the joy of paying.",
            "让付费的快乐，重新回到您的生活。",
          )}
        </p>
        <div className="hero-search">
          <SearchBox />
          <div className="try-projects">
            <span>{t("CURRENTLY SAVING WITH", "正在被这些项目省钱")}</span>
            {["Penpot", "Grafana", "Zulip", "Bruno"].map((project) => (
              <Link key={project} to={`/search?q=${project}`}>
                {project}
                <Icon name="diagonal" size={12} />
              </Link>
            ))}
          </div>
          <p className="beta-note">
            {t(
              "BETA · A growing, curated directory. An indexed repository may not have a reviewed alternative yet. These example projects do.",
              "测试版 · 精选目录持续扩充中。仓库有索引，不代表已有核验好的推荐；上方示例已收录对应关系。",
            )}
          </p>
        </div>
        <div className="hero-footnote">
          <Icon name="shield" size={14} />
          <span>
            {t(
              "No source code. No unnecessary freedom. Just possibilities.",
              "没有源码，没有多余的自由。只有无限付费的可能。",
            )}
          </span>
        </div>
        <div className="hero-margin-note" aria-hidden="true">
          <span>LESS IS MORE.</span>
          <span>EXCEPT YOUR BILL.</span>
          <Icon name="arrow" size={28} />
        </div>
      </section>
      <div className="principles-strip">
        <div className="container principles-inner">
          <span>
            <Icon name="receipt" size={17} />
            {t("Premium by price", "以价格，定义高端")}
          </span>
          <span>
            <Icon name="lock" size={16} />
            {t("Proprietary by principle", "以闭源，坚持原则")}
          </span>
          <span>
            <Icon name="sparkle" size={17} />
            {t("Vendor lock-in, built in", "供应商绑定，开箱即享")}
          </span>
          <span className="strip-aside">
            {t("Freedom is a feature. We removed it.", "自由是一项功能。我们将其精简了。")}
          </span>
        </div>
      </div>
      <section className="discover-section container">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{t("CURATED FINANCIAL COMMITMENTS", "精选长期支出")}</span>
            <h2>
              {t("Goodbye freedom.", "告别自由。 ")}{" "}
              <span className="serif">{t("Hello enterprise.", "拥抱企业版。")}</span>
            </h2>
          </div>
          <Link className="text-link" to="/search?q=Penpot">
            {t("Explore the directory", "探索闭源目录")}
            <Icon name="arrow" size={17} />
          </Link>
        </div>
        <div className="demo-notice">
          <span className="demo-badge">RESEARCH</span>
          {t(
            "Search real repositories and source-linked alternatives. Pricing observations include their configuration and review date.",
            "搜索真实仓库与带来源的替代品。价格记录保留具体配置和核验日期。",
          )}
        </div>
        <div className="product-grid">
          {[
            { name: "Penpot", en: "Design & prototyping", zh: "设计与原型" },
            { name: "Grafana", en: "Observability", zh: "可观测性" },
            { name: "Zulip", en: "Team communication", zh: "团队沟通" },
            { name: "Bruno", en: "API development", zh: "API 开发" },
            { name: "Appsmith", en: "Internal tools", zh: "内部工具" },
            { name: "Activepieces", en: "Automation", zh: "工作流自动化" },
          ].map((project) => (
            <Link
              className="product-card project-discovery"
              key={project.name}
              to={`/search?q=${project.name}`}
            >
              <span className="eyebrow">{t(project.en, project.zh)}</span>
              <h3>{project.name}</h3>
              <p>{t("Find your next financial commitment.", "寻找您的下一笔长期支出。")}</p>
              <span className="text-link">
                {t("View researched alternatives", "查看研究目录")}
                <Icon name="arrow" size={17} />
              </span>
            </Link>
          ))}
        </div>
        <div className="ranking-note">
          <span>
            <Icon name="sliders" size={14} />
            {t(
              "Verified unit prices, highest first within each billing basis",
              "已核验单价，同一计费口径内降序",
            )}
          </span>
          <span>{t("Because you deserve the most. Expensive.", "因为您，值得最贵的。")}</span>
        </div>
        <Link className="text-link catalog-contribute" to="/contribute">
          {t("Missing your project? Help expand the directory.", "没有您的项目？一起来补充目录。 ")}
          <Icon name="arrow" size={16} />
        </Link>
      </section>
      <section className="manifesto-teaser container">
        <div className="manifesto-art" aria-hidden="true">
          <div className="art-circle">
            <Icon name="lock" size={65} />
          </div>
          <span className="art-orbit orbit-one" />
          <span className="art-orbit orbit-two" />
          <span className="art-label">SOURCE: UNAVAILABLE</span>
          <span className="art-coordinate">01 / PROPRIETARY BY DESIGN</span>
        </div>
        <div className="manifesto-content">
          <span className="eyebrow">
            {t("A PERFECTLY REASONABLE PHILOSOPHY", "一套完全合理的价值观")}
          </span>
          <h2>
            {t("You’ve tried freedom.", "您已经体验过自由。")}
            <br />
            <span className="serif">{t("Now try procurement.", "现在试试采购流程。")}</span>
          </h2>
          <p>
            {t(
              "Why spend an afternoon deploying something yourself when you could spend three weeks scheduling a demo? We believe software should come with a dedicated account manager. And a cancellation policy.",
              "既然可以花三周预约一场演示，为什么要用一个下午自行部署？我们相信，软件应该配备专属客户经理，以及一份取消订阅条款。",
            )}
          </p>
          <Link className="text-link" to="/manifesto">
            {t("Read our very serious manifesto", "阅读我们极其严肃的宣言")}
            <Icon name="arrow" size={17} />
          </Link>
        </div>
      </section>
      <section className="bottom-note container">
        <span className="small-asterisk">✳</span>
        <p>
          {t(
            "The only thing we’re not charging for is the irony.",
            "我们唯一没有收费的，是这份讽刺。",
          )}
        </p>
        <Link to="/faq">
          {t("Questions? We have talking points.", "有疑问？我们准备好了话术。")}
          <Icon name="diagonal" size={14} />
        </Link>
      </section>
    </>
  );
}
