import { useEffect, useRef } from "react";
import { useLocale } from "../lib/locale";
import { repositoryUrl } from "../lib/site-config";
import { BrandMark, Icon } from "./Icon";

export function SourceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { t } = useLocale();
  useEffect(() => {
    const element = dialog.current;
    if (open && !element?.open) element?.showModal();
    if (!open && element?.open) element.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className="source-dialog"
      aria-labelledby="source-dialog-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <button
        className="icon-button dialog-close"
        onClick={onClose}
        type="button"
        aria-label={t("Close", "关闭")}
      >
        <Icon name="close" />
      </button>
      <BrandMark large />
      <span className="eyebrow">{t("A SMALL CONFLICT OF INTEREST", "一个小小的立场冲突")}</span>
      <h2 id="source-dialog-title">{t("Yes. This is open source.", "是的。本站完全开源。")}</h2>
      <p>
        {t(
          "The frontend, the backend, the design. All MIT licensed. We appear to have become the very thing we set out to replace.",
          "前端、后端、设计，全部采用 MIT 许可证。我们似乎成为了自己试图替代的那种软件。",
        )}
      </p>
      <div className="source-facts">
        <span>
          <Icon name="check" />
          {t("100% open source", "100% 开源")}
        </span>
        <span>
          <Icon name="check" />
          MIT License
        </span>
        <span>
          <Icon name="check" />
          {t("No paid dependencies", "无付费依赖")}
        </span>
      </div>
      {repositoryUrl ? (
        <div className="source-repository">
          <a
            className="button button-dark"
            href={repositoryUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("View the GitHub repository", "查看 GitHub 仓库")}
            <Icon name="diagonal" size={16} />
          </a>
        </div>
      ) : (
        <p className="fine-print">
          {t(
            "The repository is being prepared for GitHub. Its public URL will be added here once published.",
            "仓库已按 GitHub 项目组织，公开发布后会在这里添加链接。",
          )}
        </p>
      )}
      <button type="button" className="button button-dark" onClick={onClose}>
        {t("An acceptable contradiction", "接受这份自相矛盾")}
        <Icon name="check" size={17} />
      </button>
    </dialog>
  );
}
