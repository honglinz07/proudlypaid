export type Category = "database" | "monitoring" | "publishing";
export type Localized = { en: string; zh: string };
export type Alternative = {
  id: string;
  name: string;
  category: Category;
  description: Localized;
  plan: string;
  monthlyUsd: number | null;
  enterprise: boolean;
  color: "orange" | "ink" | "green";
  initials: string;
};

export const demoProjects = ["Supabase", "PostgreSQL", "Grafana", "Ghost"] as const;

const projectCategories: Record<string, Category> = {
  supabase: "database",
  postgresql: "database",
  postgres: "database",
  grafana: "monitoring",
  ghost: "publishing",
};

// Every alternative and price below is fictional, for interface demonstration only.
// One comparable billing basis: USD / workspace / month, including ten seats.
export const demoAlternatives: readonly Alternative[] = [
  {
    id: "paybase",
    name: "Paybase",
    category: "database",
    description: {
      en: "All your data. A carefully negotiated amount of control.",
      zh: "您的全部数据，以及经过谨慎协商的部分控制权。",
    },
    plan: "Enterprise Plus",
    monthlyUsd: 2499,
    enterprise: true,
    color: "orange",
    initials: "p/",
  },
  {
    id: "vaultstack",
    name: "Vaultstack",
    category: "database",
    description: {
      en: "A backend you can depend on. And become dependent on.",
      zh: "值得依赖的后端。然后您就离不开它了。",
    },
    plan: "Business Platinum",
    monthlyUsd: 899,
    enterprise: false,
    color: "ink",
    initials: "vs",
  },
  {
    id: "meterdb",
    name: "MeterDB",
    category: "database",
    description: {
      en: "Every query counts. Our billing team makes sure of it.",
      zh: "每次查询都很重要。我们的财务团队会确保这一点。",
    },
    plan: "Professional",
    monthlyUsd: 299,
    enterprise: false,
    color: "green",
    initials: "m_",
  },
  {
    id: "opaque-cloud",
    name: "Opaque Cloud",
    category: "database",
    description: {
      en: "Even the price is proprietary. An impressive commitment.",
      zh: "连价格都是闭源的。令人钦佩的执行力。",
    },
    plan: "Executive",
    monthlyUsd: null,
    enterprise: true,
    color: "ink",
    initials: "oc",
  },
  {
    id: "spendscope",
    name: "Spendscope",
    category: "monitoring",
    description: {
      en: "Complete visibility. Except into how we calculate your bill.",
      zh: "全面的可观测性。账单的计算方式除外。",
    },
    plan: "Enterprise Plus",
    monthlyUsd: 3499,
    enterprise: true,
    color: "orange",
    initials: "ss",
  },
  {
    id: "alertier",
    name: "Alertier",
    category: "monitoring",
    description: {
      en: "The first alert is about your monthly spending.",
      zh: "第一条告警，来自您的月度支出。",
    },
    plan: "Business Platinum",
    monthlyUsd: 1299,
    enterprise: false,
    color: "ink",
    initials: "a!",
  },
  {
    id: "billwatch",
    name: "Billwatch",
    category: "monitoring",
    description: {
      en: "Monitor everything. Especially your credit limit.",
      zh: "监控一切。尤其是您的信用额度。",
    },
    plan: "Professional",
    monthlyUsd: 499,
    enterprise: false,
    color: "green",
    initials: "bw",
  },
  {
    id: "paypress",
    name: "Paypress",
    category: "publishing",
    description: {
      en: "Your words deserve a more expensive place to live.",
      zh: "您的文字，值得一个租金更贵的地方。",
    },
    plan: "Enterprise Plus",
    monthlyUsd: 1999,
    enterprise: true,
    color: "orange",
    initials: "pp",
  },
  {
    id: "rentletters",
    name: "Rentletters",
    category: "publishing",
    description: {
      en: "Own your audience. Lease the privilege of reaching them.",
      zh: "拥有您的读者。租用联系他们的权利。",
    },
    plan: "Business Platinum",
    monthlyUsd: 699,
    enterprise: false,
    color: "ink",
    initials: "rl",
  },
  {
    id: "invoice-ink",
    name: "Invoice & Ink",
    category: "publishing",
    description: {
      en: "Beautiful publishing. Beautifully recurring payments.",
      zh: "优雅地出版。优雅地持续扣款。",
    },
    plan: "Professional",
    monthlyUsd: 199,
    enterprise: false,
    color: "green",
    initials: "i&",
  },
];

export type DemoFilters = { maxPrice: number; enterpriseOnly: boolean; includeQuote: boolean };
export const defaultFilters: DemoFilters = {
  maxPrice: 5000,
  enterpriseOnly: false,
  includeQuote: true,
};

export function getDemoResults(
  query: string,
  filters: DemoFilters = defaultFilters,
): Alternative[] {
  const category = projectCategories[query.trim().toLowerCase()];
  if (!category) return [];
  return demoAlternatives
    .filter((item) => item.category === category)
    .filter((item) => !filters.enterpriseOnly || item.enterprise)
    .filter((item) =>
      item.monthlyUsd === null ? filters.includeQuote : item.monthlyUsd <= filters.maxPrice,
    )
    .sort((a, b) => (b.monthlyUsd ?? -1) - (a.monthlyUsd ?? -1));
}
