import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Icon } from "../components/Icon";
import { contributionIssueUrl, formatContribution, isPublicSourceUrl } from "../lib/contributions";
import { useLocale } from "../lib/locale";
import { repositoryUrl } from "../lib/site-config";

export function ContributePage() {
  const { t } = useLocale();
  const [params] = useSearchParams();
  const [project, setProject] = useState(() => (params.get("project") ?? "").slice(0, 200));
  const [product, setProduct] = useState("");
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"idle" | "copied" | "copy-failed" | "downloaded">("idle");
  const [invalid, setInvalid] = useState(false);
  const previewRef = useRef<HTMLElement>(null);
  const issueUrl = contributionIssueUrl(repositoryUrl);
  useEffect(() => {
    if (draft) previewRef.current?.focus();
  }, [draft]);
  const reset = () => {
    setDraft("");
    setStatus("idle");
    setInvalid(false);
  };

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft);
      setStatus("copied");
    } catch {
      setStatus("copy-failed");
    }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([draft], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "proudlypaid-catalog-suggestion.md";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus("downloaded");
  }

  return (
    <section className="contribution-page container">
      <div className="page-intro">
        <span className="eyebrow">
          {t("UNPAID RESEARCH. PAID ALTERNATIVES.", "无偿研究，有偿替代")}
        </span>
        <h1>
          {t("Help us find", "帮我们发现")}{" "}
          <span className="serif">{t("the next invoice.", "下一张账单。")}</span>
        </h1>
        <p>
          {t(
            "Suggest an alternative, request coverage, or correct a price. Our procurement department accepts evidence.",
            "补充替代品、申请收录或纠正价格。我们的采购部门接受事实依据。",
          )}
        </p>
      </div>
      <div className="contribution-layout">
        <form
          className="contribution-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!project.trim() || !isPublicSourceUrl(source)) {
              setInvalid(true);
              return;
            }
            setDraft(formatContribution({ project, product, source, notes }));
            setStatus("idle");
            setInvalid(false);
          }}
        >
          <label htmlFor="suggest-project">
            {t("Open-source project or GitHub URL", "开源项目名称或 GitHub 地址")} <span>*</span>
          </label>
          <input
            id="suggest-project"
            required
            maxLength={200}
            value={project}
            onChange={(event) => {
              setProject(event.target.value);
              reset();
            }}
            placeholder="e.g. Penpot / https://github.com/penpot/penpot"
          />
          <label htmlFor="suggest-product">
            {t("Paid alternative or correction", "付费替代品或需要修正的内容")}
          </label>
          <input
            id="suggest-product"
            maxLength={160}
            value={product}
            onChange={(event) => {
              setProduct(event.target.value);
              reset();
            }}
            placeholder={t(
              "Optional — a project request is welcome too",
              "选填，不知道替代品也可以申请补充",
            )}
          />
          <label htmlFor="suggest-source">
            {t("Official product or pricing page", "官网或官方价格页")}
          </label>
          <input
            id="suggest-source"
            type="url"
            maxLength={1000}
            value={source}
            aria-invalid={invalid && !isPublicSourceUrl(source)}
            onChange={(event) => {
              setSource(event.target.value);
              reset();
            }}
            placeholder="https://"
          />
          <label htmlFor="suggest-notes">{t("Evidence and limitations", "依据与限制说明")}</label>
          <textarea
            id="suggest-notes"
            rows={5}
            maxLength={3000}
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
              reset();
            }}
            placeholder={t(
              "What overlaps? For a price correction, include the currency, payment cycle and plan configuration.",
              "哪些功能相近？修正价格时，请注明币种、年付或月付、套餐配置。",
            )}
          />
          {invalid && (
            <p className="contribution-error" role="alert">
              {t(
                "Enter a project and use an HTTPS source without login details.",
                "请填写项目名称；来源需使用不含登录信息的 HTTPS 地址。",
              )}
            </p>
          )}
          <button className="button button-primary" type="submit">
            {t("Prepare a research lead", "整理这条线索")}
            <Icon name="arrow" size={16} />
          </button>
          <p className="contribution-privacy">
            {t(
              "Only public information, please. This form prepares text in your browser; it does not send or save your draft on our server.",
              "请只填写公开资料。此表单仅在浏览器中整理文字，不会向本站服务器发送或保存草稿。",
            )}
          </p>
        </form>
        <aside className="contribution-guide">
          <span className="demo-badge">BETA</span>
          <h2>{t("Every lead gets reviewed.", "每条线索，都要核验。")}</h2>
          <p>
            {t(
              "Paid does not automatically mean proprietary. We check the specific product scope, official sources and billing configuration before publishing.",
              "付费不自动等于闭源。公开展示前，我们会核对具体产品范围、官方来源和计费配置。",
            )}
          </p>
          <ol>
            <li>{t("Prepare and review the text below.", "整理并检查下方文字。")}</li>
            <li>
              {issueUrl
                ? t(
                    "Copy it, then paste it into a GitHub issue.",
                    "复制文字，再粘贴到 GitHub issue。",
                  )
                : t(
                    "Copy or download it for now. The public submission link will appear here when the repository is published.",
                    "先复制或下载保存，仓库公开后这里会提供提交入口。",
                  )}
            </li>
            <li>{t("Nothing enters the catalog automatically.", "线索不会自动进入推荐目录。")}</li>
          </ol>
          <Link className="text-link" to="/faq">
            {t("How the directory works", "了解目录规则")}
            <Icon name="diagonal" size={14} />
          </Link>
        </aside>
      </div>
      {draft && (
        <section
          className="contribution-preview"
          ref={previewRef}
          tabIndex={-1}
          aria-label={t("Research lead preview", "线索预览")}
        >
          <h2>{t("Ready for human review.", "准备交给人类核验。")}</h2>
          <label className="sr-only" htmlFor="contribution-draft">
            {t("Copyable research lead", "可复制的线索文字")}
          </label>
          <textarea id="contribution-draft" readOnly rows={15} value={draft} />
          <div className="contribution-actions">
            <button className="button button-dark" type="button" onClick={() => void copy()}>
              {t("Copy text", "复制文字")}
            </button>
            <button className="button" type="button" onClick={download}>
              {t("Download Markdown", "下载 Markdown")}
            </button>
            {issueUrl && (
              <a className="button" href={issueUrl} target="_blank" rel="noopener noreferrer">
                {t("Open GitHub to submit", "前往 GitHub 提交")}
                <Icon name="diagonal" size={14} />
              </a>
            )}
          </div>
          <p className="contribution-status" role="status">
            {status === "copied"
              ? t(
                  "Copied. Review it before submitting on GitHub.",
                  "已复制，提交到 GitHub 前请再检查一遍。",
                )
              : status === "copy-failed"
                ? t(
                    "Copy was unavailable. Select the text above to copy manually, or download it.",
                    "暂时无法自动复制，可以选中上方文字手动复制，或下载保存。",
                  )
                : status === "downloaded"
                  ? t(
                      "Download requested. This has not been submitted to the catalog.",
                      "已发起下载，此线索尚未提交到目录。",
                    )
                  : t("Prepared locally. Not submitted yet.", "已在本地整理，尚未提交。")}
          </p>
        </section>
      )}
    </section>
  );
}
