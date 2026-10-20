import { Link } from "react-router";
import { Icon } from "../components/Icon";
import { useLocale } from "../lib/locale";

export function NotFoundPage() {
  const { t } = useLocale();
  return (
    <section className="not-found container">
      <span className="eyebrow">{t("RESOURCE ACCESS REVIEW", "资源访问资格审查")}</span>
      <div className="error-code" role="img" aria-label="404">
        4
        <span>
          <Icon name="lock" size={72} />
        </span>
        4
      </div>
      <h1>
        {t("This page is not included", "您当前的套餐")}
        <br />
        <span className="serif">{t("in your current plan.", "不包含此页面。")}</span>
      </h1>
      <p>
        {t(
          "Actually, it doesn’t exist. But we admire your willingness to explore additional expenses.",
          "实际上，这个页面并不存在。但我们欣赏您探索额外支出的积极态度。",
        )}
      </p>
      <Link className="button button-primary" to="/">
        {t("Return to what you can afford", "返回您有权访问的首页")}
        <Icon name="arrow" size={17} />
      </Link>
      <span className="fine-print">
        {t(
          "Error 404 · Upgrading won’t help. We checked.",
          "错误 404 · 升级套餐也没用。我们确认过了。",
        )}
      </span>
    </section>
  );
}
