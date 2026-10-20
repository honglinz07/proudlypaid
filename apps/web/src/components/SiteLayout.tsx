import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { useLocale } from "../lib/locale";
import { BrandMark, Icon } from "./Icon";
import { SourceDialog } from "./SourceDialog";

export function SiteLayout() {
  const { language, setLanguage, t } = useLocale();
  const [sourceOpen, setSourceOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    setMenuOpen(false);
    const page =
      location.pathname === "/"
        ? ""
        : location.pathname === "/search"
          ? t("Search", "搜索")
          : location.pathname === "/faq"
            ? "FAQ"
            : location.pathname === "/contribute"
              ? t("Contribute", "补充目录")
              : location.pathname === "/manifesto"
                ? t("Our philosophy", "闭源宣言")
                : "404";
    document.title = `${page ? `${page} · ` : ""}proudlypaid — ${t("Your software is free. Let's fix that.", "您的软件居然免费。我们来解决这个问题。")}`;
  }, [location.pathname, t]);

  return (
    <div className="site-shell">
      <a href="#main" className="skip-link">
        {t("Skip to content", "跳转到正文")}
      </a>
      <header className="site-header container">
        <Link to="/" className="brand" aria-label={t("proudlypaid home", "proudlypaid 首页")}>
          <BrandMark />
          <span>
            proudlypaid<span className="brand-dot">.</span>
          </span>
          <span className="beta-badge">BETA</span>
        </Link>
        <nav
          className={`main-nav ${menuOpen ? "is-open" : ""}`}
          aria-label={t("Main navigation", "主导航")}
        >
          <NavLink to="/" end>
            {t("The directory", "闭源目录")}
          </NavLink>
          <NavLink to="/manifesto">{t("Our philosophy", "闭源宣言")}</NavLink>
          <NavLink to="/faq">FAQ</NavLink>
          <NavLink to="/contribute">{t("Contribute", "补充目录")}</NavLink>
        </nav>
        <div className="header-actions">
          <button
            className="language-button"
            type="button"
            onClick={() => setLanguage(language === "en" ? "zh" : "en")}
            aria-label={language === "en" ? "切换为中文" : "Switch to English"}
          >
            <Icon name="globe" size={16} />
            <span>{language === "en" ? "中文" : "EN"}</span>
          </button>
          <button
            className="button source-button"
            type="button"
            aria-label={t("Source code", "查看源码")}
            onClick={() => setSourceOpen(true)}
          >
            <Icon name="code" size={17} />
            <span>{t("Source code", "查看源码")}</span>
            <Icon name="diagonal" size={14} />
          </button>
          <button
            className="icon-button mobile-menu"
            type="button"
            aria-expanded={menuOpen}
            aria-label={t("Toggle navigation", "展开或收起导航")}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Icon name={menuOpen ? "close" : "menu"} />
          </button>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="site-footer container">
        <div className="footer-top">
          <Link to="/" className="brand footer-brand">
            <BrandMark />
            <span>
              proudlypaid<span className="brand-dot">.</span>
            </span>
          </Link>
          <p>{t("Less source. More invoices.", "更少源码，更多账单。")}</p>
          <div>
            <Link to="/manifesto">{t("Manifesto", "闭源宣言")}</Link>
            <Link to="/faq">FAQ</Link>
            <Link to="/contribute">{t("Contribute", "补充目录")}</Link>
            <button type="button" onClick={() => setSourceOpen(true)}>
              {t("Open source, ironically", "讽刺的是，本站开源")}
              <Icon name="diagonal" size={13} />
            </button>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} proudlypaid.{" "}
            {t("Some irony intended.", "部分讽刺，纯属故意。")}
          </span>
          <span>
            <span className="status-dot" />
            {t("All systems monetizable", "所有系统均可付费")}
          </span>
          <span>
            {t("Made with open source. We’re working on it.", "使用开源软件构建。我们正在反省。")}
          </span>
        </div>
      </footer>
      <SourceDialog open={sourceOpen} onClose={() => setSourceOpen(false)} />
    </div>
  );
}
