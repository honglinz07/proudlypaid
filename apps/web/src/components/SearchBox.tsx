import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useLocale } from "../lib/locale";
import { Icon } from "./Icon";

export function SearchBox({
  initialQuery = "",
  compact = false,
}: {
  initialQuery?: string;
  compact?: boolean;
}) {
  const [query, setQuery] = useState(initialQuery);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const navigate = useNavigate();
  const { t } = useLocale();
  useEffect(() => setQuery(initialQuery), [initialQuery]);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      if (
        event.key === "/" &&
        !(
          target instanceof HTMLElement &&
          (target.matches("input, textarea, select") || target.isContentEditable)
        )
      ) {
        event.preventDefault();
        input.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    else input.current?.focus();
  }

  return (
    <search>
      <form className={`search-box ${compact ? "search-box-compact" : ""}`} onSubmit={submit}>
        <Icon name="search" size={23} />
        <label htmlFor={id} className="sr-only">
          {t("Open-source project", "开源项目名称")}
        </label>
        <input
          ref={input}
          id={id}
          name="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t(
            "Which open-source project is saving you money?",
            "哪个开源项目，正在阻碍您花钱？",
          )}
          maxLength={120}
          autoComplete="off"
          required
        />
        {!compact && <kbd title={t("Press / to focus search", "按 / 聚焦搜索框")}>/</kbd>}
        <button className="button button-primary" type="submit">
          <span>{t("Find alternatives", "寻找闭源替代")}</span>
          <Icon name="arrow" size={18} />
        </button>
      </form>
    </search>
  );
}
