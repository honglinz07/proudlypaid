import { useState } from "react";
import type { Alternative } from "../lib/demo-catalog";
import { useLocale } from "../lib/locale";
import { Icon } from "./Icon";

export function ProductCard({
  product,
  index = 0,
  featured = false,
}: {
  product: Alternative;
  index?: number;
  featured?: boolean;
}) {
  const { t, language } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const price = product.monthlyUsd?.toLocaleString("en-US");
  return (
    <article className={`product-card ${featured ? "product-card-featured" : ""}`}>
      <div className="product-top">
        <div className={`product-logo logo-${product.color}`} aria-hidden="true">
          {product.initials}
        </div>
        <span className="product-category">
          {product.category === "database"
            ? t("DATABASE & BACKEND", "数据库与后端")
            : product.category === "monitoring"
              ? t("OBSERVABILITY", "可观测性")
              : t("PUBLISHING", "内容出版")}
        </span>
        <Icon name="lock" size={14} />
      </div>
      <div className="product-title">
        <h3>{product.name}</h3>
        {index === 0 && <span className="premium-label">{t("TOP EXPENSE", "头号支出")}</span>}
      </div>
      <p className="product-description">{product.description[language]}</p>
      <div className="product-plan">
        <span className="tiny-square" />
        {product.plan}
        <span>{t("Closed source", "闭源")}</span>
      </div>
      <div className="product-bottom">
        <div>
          {price ? (
            <>
              <strong>${price}</strong>
              <span className="price-unit">{t("/ mo", "/ 月")}</span>
            </>
          ) : (
            <strong className="quote-price">{t("Let’s talk.", "请联系销售。")}</strong>
          )}
          <small>{t("USD · per workspace", "美元 · 每工作区")}</small>
        </div>
        <button
          className="icon-button product-arrow"
          type="button"
          aria-label={t(`View ${product.name} details`, `查看 ${product.name} 详情`)}
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          <Icon name={expanded ? "close" : "diagonal"} size={20} />
        </button>
      </div>
      {expanded && (
        <div className="product-details">
          <span className="eyebrow">
            {t("FICTIONAL PRODUCT · DEMO ONLY", "虚构产品 · 仅供演示")}
          </span>
          <p>
            {t(
              "Illustrative plan includes 10 seats, annual commitment, and a relationship with a sales representative. No purchase is available.",
              "示例套餐包含 10 个席位、年度承诺，以及与销售代表的长期关系。本站不提供购买。",
            )}
          </p>
          {product.monthlyUsd === null && (
            <p>
              {t(
                "Undisclosed pricing is listed after known prices and is not included in the price ranking.",
                "价格未公开，展示在已知价格之后，不参与价格排名。",
              )}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
