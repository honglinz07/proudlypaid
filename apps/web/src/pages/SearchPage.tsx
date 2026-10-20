import type { AlternativesResponse, SearchResponse } from "@closedsources/contracts";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { CatalogProductCard } from "../components/CatalogProductCard";
import { Icon } from "../components/Icon";
import { SearchBox } from "../components/SearchBox";
import { CatalogApiError, getAlternatives, searchProjects } from "../lib/catalog-api";
import { contributionPath } from "../lib/contributions";
import { useLocale } from "../lib/locale";

type LoadState = {
  key: string;
  loading: boolean;
  search?: SearchResponse;
  detail?: AlternativesResponse;
  error?: string;
};
const suggestions = ["Penpot", "Grafana", "Zulip", "OpenProject"];

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q")?.trim() ?? "";
  const requestedProject = params.get("project");
  const [retry, setRetry] = useState(0);
  const key = JSON.stringify([query, requestedProject, retry]);
  const [loaded, setLoaded] = useState<LoadState>({ key: "", loading: false });
  const [groupKey, setGroupKey] = useState("all");
  const [budget, setBudget] = useState("");
  const [showNonFixed, setShowNonFixed] = useState(true);
  const { t } = useLocale();
  const state: LoadState = loaded.key === key ? loaded : { key, loading: Boolean(query) };

  useEffect(() => {
    const controller = new AbortController();
    setGroupKey("all");
    setBudget("");
    if (!query) {
      setLoaded({ key, loading: false });
      return () => controller.abort();
    }
    setLoaded({ key, loading: true });
    async function load() {
      try {
        const search = await searchProjects(query, controller.signal);
        if (controller.signal.aborted) return;
        const projectId = requestedProject ?? search.preferredProjectId;
        setLoaded({ key, loading: Boolean(projectId), search });
        if (projectId) {
          const detail = await getAlternatives(projectId, controller.signal);
          if (!controller.signal.aborted) setLoaded({ key, loading: false, search, detail });
        }
      } catch (error) {
        if (!controller.signal.aborted)
          setLoaded({
            key,
            loading: false,
            error: error instanceof CatalogApiError ? error.code : "NETWORK_ERROR",
          });
      }
    }
    void load();
    return () => controller.abort();
  }, [query, requestedProject, key]);

  const detail = state.detail;
  const groups =
    detail?.priceGroups
      .filter((group) => groupKey === "all" || group.key === groupKey)
      .map((group) => ({
        ...group,
        entries: group.entries.filter(
          (entry) =>
            groupKey === "all" ||
            budget === "" ||
            (entry.price.amount !== null && entry.price.amount <= Number(budget)),
        ),
      })) ?? [];
  const priceCount = groups.reduce((total, group) => total + group.entries.length, 0);
  const groupLabel = (group: {
    currency: string;
    unit: string;
    period: string;
    billing: string;
  }) => {
    const units: Record<string, string> = {
      "full-seat": t("Full seat", "Full 席位"),
      "infrastructure-host": t("infrastructure host", "基础设施主机"),
      "full-platform-user": t("full-platform user", "全平台用户"),
      user: t("user", "用户"),
      editor: t("editor", "编辑"),
      member: t("member", "成员"),
      seat: t("seat", "席位"),
      account: t("account", "账户"),
      subscription: t("subscription", "订阅"),
      builder: t("builder", "应用构建者"),
      "internal-user": t("internal user", "内部用户"),
    };
    const periods: Record<string, string> = {
      month: t("month", "月"),
      year: t("year", "年"),
      "one-time": t("one time", "一次性"),
    };
    const billing: Record<string, string> = {
      annual: t("billed annually", "年付"),
      monthly: t("billed monthly", "月付"),
      "one-time": t("one-time payment", "一次付款"),
    };
    return `${group.currency} / ${units[group.unit] ?? group.unit} / ${periods[group.period] ?? group.period} · ${billing[group.billing] ?? group.billing}`;
  };

  return (
    <section className="search-page container">
      <div className="page-intro">
        <span className="eyebrow">{t("THE CLOSED-SOURCE DIRECTORY", "闭源替代品目录")}</span>
        <h1>
          {t("Your next", "您的下一笔")}{" "}
          <span className="serif">{t("financial commitment.", "长期支出。")}</span>
        </h1>
        <p>{t("Your project is real. So is the paperwork.", "项目是真的。采购流程也是。")}</p>
      </div>
      <SearchBox initialQuery={query} compact />
      <div className="demo-notice search-notice">
        <span className="demo-badge">RESEARCH</span>
        <span>
          {t(
            "Beta research directory, not live quotes. Indexed repositories may lack reviewed alternatives. Only reviewed product scopes and verified price observations are displayed; overlapping features do not establish full interchangeability.",
            "测试版研究目录，价格并非实时报价。已索引仓库也可能暂缺推荐。仅展示已审阅的产品范围和已核验价格；功能重叠不代表可以完整互换。",
          )}
        </span>
      </div>
      <div className="search-layout">
        <aside className="filters-panel" aria-label={t("Price component filters", "计费组件筛选")}>
          <div className="filters-title">
            <h2>
              <Icon name="sliders" size={18} />
              {t("Refine your expenses", "精细规划支出")}
            </h2>
            <button
              type="button"
              onClick={() => {
                setGroupKey("all");
                setBudget("");
                setShowNonFixed(true);
              }}
            >
              {t("Reset", "重置")}
            </button>
          </div>
          <div className="filter-group catalog-filter">
            <label htmlFor="price-basis">{t("Billing basis", "计费口径")}</label>
            <select
              id="price-basis"
              value={groupKey}
              onChange={(event) => {
                setGroupKey(event.target.value);
                setBudget("");
              }}
              disabled={!detail?.priceGroups.length}
            >
              <option value="all">
                {t("All groups, listed separately", "全部口径，分别展示")}
              </option>
              {detail?.priceGroups.map((group) => (
                <option key={group.key} value={group.key}>
                  {groupLabel(group)}
                </option>
              ))}
            </select>
            <label htmlFor="component-budget">{t("Unit price ceiling", "单项价格上限")}</label>
            <input
              id="component-budget"
              type="number"
              min="0"
              step="any"
              value={budget}
              disabled={groupKey === "all"}
              placeholder={t("No ceiling", "无上限")}
              onChange={(event) =>
                setBudget(
                  event.target.value === "" ? "" : String(Math.max(0, Number(event.target.value))),
                )
              }
            />
            <p>
              {t(
                "Choose one billing basis to filter its unit prices. Your accountant insisted.",
                "先选择一个计费口径，再筛选该口径的单价。这是会计的坚持。",
              )}
            </p>
          </div>
          <div className="filter-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showNonFixed}
                onChange={(event) => setShowNonFixed(event.target.checked)}
              />
              <span>{t("Show quotes & usage models", "展示询价和用量模型")}</span>
            </label>
          </div>
          <div className="filter-disclaimer">
            <Icon name="receipt" size={22} />
            <strong>{t("A fair comparison. Unfortunately.", "遗憾的是，我们公平比较。")}</strong>
            <p>
              {t(
                "Descending unit prices within each currency, unit, period and billing cycle. Components are not complete bills; configurations and product scope still differ.",
                "按币种、单位、展示周期和付款周期分别降序排列。这里只比较公开计费组件，不估算完整账单；配置及产品范围仍可能不同。",
              )}
            </p>
          </div>
        </aside>
        <div className="results-panel" aria-busy={state.loading}>
          <div className="results-heading">
            <p aria-live="polite">
              {state.loading
                ? t("Preparing your procurement options…", "正在准备您的采购选项……")
                : state.search
                  ? t(
                      `${state.search.projects.length}${state.search.truncated ? "+" : ""} matching repositories`,
                      `${state.search.projects.length}${state.search.truncated ? "+" : ""} 个匹配仓库`,
                    )
                  : t("Every invoice begins with a search.", "每张账单，都始于一次搜索。")}
            </p>
            <span className="sort-label">
              {t("Name · alias · repository", "项目名 · 别名 · 仓库地址")}
            </span>
          </div>
          {state.error ? (
            <div className="empty-state" role="alert">
              <Icon name="receipt" size={30} />
              <h2>{t("Procurement is temporarily delayed.", "采购流程暂时延误。")}</h2>
              <p>
                {state.error === "INVALID_QUERY"
                  ? t("Enter 1–120 characters.", "请输入 1–120 个字符。")
                  : state.error === "CATALOG_NOT_READY"
                    ? t(
                        "The catalog has not been initialized yet.",
                        "目录尚未初始化，请先导入数据库。",
                      )
                    : t(
                        "The catalog could not be loaded. Please retry.",
                        "暂时无法读取目录，请重试。",
                      )}
              </p>
              <button
                type="button"
                className="button button-primary"
                onClick={() => setRetry(retry + 1)}
              >
                {t("Retry", "重试")}
              </button>
            </div>
          ) : (
            <>
              {state.search && state.search.projects.length > 0 && (
                <div className="project-matches">
                  {(state.search.projects.length > 1 || state.search.match === "fuzzy") && (
                    <p className="catalog-muted">
                      {state.search.match === "fuzzy"
                        ? t(
                            "Possible spelling matches. Select your repository to continue.",
                            "这些可能是拼写相近的项目，请确认仓库。",
                          )
                        : t(
                            "Select the repository you use. Forks also deserve invoices.",
                            "请选择您使用的仓库。Fork 也值得拥有账单。",
                          )}
                    </p>
                  )}
                  <div className="project-options">
                    {state.search.projects.map((project) => (
                      <button
                        type="button"
                        key={project.id}
                        className={`project-option ${detail?.project.id === project.id ? "is-selected" : ""}`}
                        aria-pressed={detail?.project.id === project.id}
                        onClick={() => setParams({ q: query, project: project.id })}
                      >
                        <strong>{project.name}</strong>
                        <span>{project.fullName}</span>
                        {project.reviewedOn && <small>{t("Catalogued", "已有研究记录")}</small>}
                      </button>
                    ))}
                  </div>
                  {state.search.truncated && (
                    <p className="catalog-muted">
                      {t(
                        "More matches exist. Use owner/repository or a GitHub URL to narrow your search.",
                        "还有更多匹配项目。可输入 owner/repository 或 GitHub 仓库地址缩小范围。",
                      )}
                    </p>
                  )}
                </div>
              )}
              {detail && (
                <>
                  <div className="catalog-project-summary">
                    <h2>{detail.project.name}</h2>
                    <a href={detail.project.repository} target="_blank" rel="noopener noreferrer">
                      {detail.project.fullName} <Icon name="diagonal" size={13} />
                    </a>
                    <p>
                      {detail.project.license ? (
                        <>
                          <a
                            href={detail.project.license.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {detail.project.license.label}
                          </a>{" "}
                          · {detail.project.license.scope} · {detail.project.reviewedOn}
                        </>
                      ) : (
                        t(
                          "Public GitHub repository. Its license and open-source scope have not been reviewed.",
                          "公开 GitHub 仓库；许可证和开源范围尚未审阅。",
                        )
                      )}
                    </p>
                  </div>
                  {detail.alternatives.length ? (
                    <>
                      <div className="catalog-section-heading">
                        <h2>{t("Published billing components", "公开计费组件")}</h2>
                        <span>{t("Highest first within each basis", "同一口径内，最高优先")}</span>
                      </div>
                      {priceCount === 0 && (
                        <p className="catalog-muted">
                          {detail.priceGroups.length
                            ? t(
                                "No components match this price filter.",
                                "没有计费组件符合当前价格筛选。",
                              )
                            : t(
                                "No verified numeric price yet. Your future invoice remains a mystery.",
                                "暂无已核验的数字价格。您的未来账单，仍是一个谜。",
                              )}
                        </p>
                      )}
                      {groups
                        .filter((group) => group.entries.length > 0)
                        .map((group) => (
                          <section
                            className="price-group"
                            key={group.key}
                            aria-label={groupLabel(group)}
                          >
                            <h3>{groupLabel(group)}</h3>
                            {group.entries.map(({ productId, price }) => (
                              <div className="price-component" key={`${productId}:${price.plan}`}>
                                <div>
                                  <strong>
                                    {
                                      detail.alternatives.find(
                                        (product) => product.id === productId,
                                      )?.name
                                    }
                                  </strong>
                                  <span>{price.plan}</span>
                                </div>
                                <strong className="component-amount">
                                  {group.currency} {price.amount?.toLocaleString("en-US")}
                                </strong>
                                <details>
                                  <summary>{t("Configuration & source", "配置与来源")}</summary>
                                  <p>{price.configuration}</p>
                                  <p>{price.notes}</p>
                                  <a
                                    href={price.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    {t("Official pricing", "官方价格资料")} · {price.reviewedOn}
                                  </a>
                                  {price.currencyEvidenceUrl && (
                                    <>
                                      <span> · </span>
                                      <a
                                        href={price.currencyEvidenceUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        {t("Currency evidence", "币种依据")}
                                      </a>
                                    </>
                                  )}
                                </details>
                              </div>
                            ))}
                          </section>
                        ))}
                      <div className="catalog-section-heading">
                        <h2>{t("Reviewed alternatives", "已审阅的替代品")}</h2>
                        <span>{detail.alternatives.length}</span>
                      </div>
                      <div className="results-grid">
                        {detail.alternatives.map((product) => (
                          <CatalogProductCard
                            key={product.id}
                            product={product}
                            showNonFixed={showNonFixed}
                          />
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="empty-state">
                      <Icon name="receipt" size={30} />
                      <h2>
                        {t("Repository found. Invoice pending.", "项目找到了。账单还在路上。")}
                      </h2>
                      <p>
                        {t(
                          "There are no reviewed proprietary alternatives for this repository yet. This is a catalog gap, not a claim that none exist.",
                          "这个仓库暂时没有审核好的闭源替代品。这表示目录仍待补充，不代表替代品不存在。",
                        )}
                      </p>
                      <Link
                        className="button button-primary catalog-contribute"
                        to={contributionPath(detail.project.repository)}
                      >
                        {t("Request coverage or suggest an alternative", "申请补充或推荐替代品")}
                        <Icon name="arrow" size={16} />
                      </Link>
                    </div>
                  )}
                  {detail.pendingAlternativeCount > 0 && (
                    <p className="catalog-pending">
                      {t(
                        `${detail.pendingAlternativeCount} candidate relationships await product classification review and are not published.`,
                        `${detail.pendingAlternativeCount} 条候选关系的产品分类仍待核验，暂不展示。`,
                      )}
                    </p>
                  )}
                </>
              )}
              {!state.loading && !detail && (!query || state.search?.projects.length === 0) && (
                <div className="empty-state">
                  <div className="empty-icon">
                    <Icon name="search" size={32} />
                  </div>
                  <h2>
                    {query
                      ? t("An unfortunate absence of invoices.", "令人遗憾的账单缺席。")
                      : t("Name your current source of savings.", "说出您目前的省钱来源。")}
                  </h2>
                  <p>
                    {query
                      ? t(
                          "No repository matched this query. Try the exact name or its GitHub URL.",
                          "没有匹配的仓库。试试准确项目名或 GitHub 仓库地址。",
                        )
                      : t(
                          "Search a project name, alias, owner/repository or GitHub URL.",
                          "支持项目名、别名、owner/repository 和 GitHub 仓库地址。",
                        )}
                  </p>
                  {query && (
                    <Link
                      className="button button-primary catalog-contribute"
                      to={contributionPath(query)}
                    >
                      {t("Request this project", "申请收录这个项目")}
                      <Icon name="arrow" size={16} />
                    </Link>
                  )}
                  <div className="empty-suggestions">
                    {suggestions.map((name) => (
                      <Link className="button" key={name} to={`/search?q=${name}`}>
                        {name}
                        <Icon name="diagonal" size={13} />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          {state.search && (
            <p className="catalog-footer">
              {t(
                `${state.search.catalog.projectCount.toLocaleString("en-US")} indexed repositories · Research batch ${state.search.catalog.reviewedOn} · Not an atomic or live GitHub snapshot.`,
                `${state.search.catalog.projectCount.toLocaleString("en-US")} 个已索引仓库 · 研究批次 ${state.search.catalog.reviewedOn} · 不是 GitHub 的实时或原子快照。`,
              )}
            </p>
          )}
          {detail && detail.alternatives.length > 0 && (
            <Link
              className="text-link catalog-contribute"
              to={contributionPath(detail.project.repository)}
            >
              {t("Suggest an alternative or correct this record", "补充替代品或纠正这条记录")}
              <Icon name="arrow" size={16} />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
