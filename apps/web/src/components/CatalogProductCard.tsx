import type { Alternative } from "@closedsources/contracts";
import { useLocale } from "../lib/locale";
import { Icon } from "./Icon";

function Evidence({ urls, label }: { urls: string[]; label: string }) {
  return (
    <div className="evidence-links">
      {urls.map((url, index) => (
        <a href={url} key={url} target="_blank" rel="noopener noreferrer">
          {label} {index + 1} <Icon name="diagonal" size={12} />
        </a>
      ))}
    </div>
  );
}

export function CatalogProductCard({
  product,
  showNonFixed,
}: {
  product: Alternative;
  showNonFixed: boolean;
}) {
  const { t } = useLocale();
  const nonfixed = product.prices.filter((price) => price.kind !== "list-price");
  return (
    <article className="product-card catalog-product">
      <div className="product-top">
        <div className="product-logo logo-green" aria-hidden="true">
          {product.name.slice(0, 2)}
        </div>
        <span className="product-category">{t("REVIEWED SCOPE", "已审阅分类范围")}</span>
        <Icon name="lock" size={14} />
      </div>
      <div className="product-title">
        <h3>
          <a href={product.homepage} target="_blank" rel="noopener noreferrer">
            {product.name} <Icon name="diagonal" size={14} />
          </a>
        </h3>
      </div>
      <p className="product-description">{product.relationship.overlap}</p>
      <div className="catalog-status">
        {product.availability.classification === "proprietary-hosted-service"
          ? t("Proprietary hosted service", "专有托管服务")
          : t("Proprietary software", "专有软件")}
      </div>
      {showNonFixed &&
        nonfixed.map((price) => (
          <div className="nonfixed-price" key={price.plan}>
            <strong>
              {price.kind === "contact-sales"
                ? t("Contact sales", "联系销售")
                : t("Usage-based", "按用量计费")}
            </strong>
            <span>{price.plan}</span>
            <p>{price.configuration}</p>
            <a href={price.sourceUrl} target="_blank" rel="noopener noreferrer">
              {t("Pricing source", "价格来源")} · {price.reviewedOn}
            </a>
          </div>
        ))}
      {product.pendingPriceCount > 0 && (
        <p className="catalog-muted">
          {t(
            `${product.pendingPriceCount} pricing observations await review; their amounts are withheld.`,
            `${product.pendingPriceCount} 条价格观察待核验，金额暂不展示。`,
          )}
        </p>
      )}
      <details className="catalog-details">
        <summary>{t("Scope, evidence & limitations", "适用范围、证据与限制")}</summary>
        <p>
          <strong>
            {t("Source classification", "闭源分类")} · {product.availability.reviewedOn}
          </strong>
        </p>
        <p>{product.availability.scope}</p>
        <p>{product.availability.notes}</p>
        <Evidence
          urls={product.availability.evidenceUrls}
          label={t("Official evidence", "官方资料")}
        />
        <p>
          <strong>
            {product.relationship.verification === "author-claimed"
              ? t("Author-positioned alternative", "项目作者的替代定位")
              : t(
                  "Researcher inference from feature overlap",
                  "根据公开功能重叠作出的研究判断",
                )}{" "}
            · {product.relationship.reviewedOn}
          </strong>
        </p>
        <p>{product.relationship.limitations}</p>
        <Evidence
          urls={product.relationship.evidenceUrls}
          label={t("Relationship evidence", "对应关系资料")}
        />
      </details>
    </article>
  );
}
