export type CompanyColorTheme = {
  accent: string;
  wash: string;
  soft: string;
  border: string;
};

export const COMPANY_COLOR_THEMES = [
  { accent: "#64748b", wash: "#eef2f6", soft: "#f8fafc", border: "#cbd5e1" },
  { accent: "#0284c7", wash: "#e0f4ff", soft: "#f0faff", border: "#bae6fd" },
  { accent: "#16a34a", wash: "#e9f8ee", soft: "#f3fbf6", border: "#bde8c9" },
  { accent: "#7c3aed", wash: "#f0eaff", soft: "#f8f5ff", border: "#d8caff" },
  { accent: "#1d4ed8", wash: "#e4ecff", soft: "#f1f5ff", border: "#b8c9ff" },
] as const satisfies readonly CompanyColorTheme[];

const COMPANY_THEME_OVERRIDES: Record<string, number> = {
  "horizon tech": 1,
  "stellar brands": 4,
};

const COMPANY_CUSTOM_THEMES: Record<string, CompanyColorTheme> = {
  instructure: { accent: "#e11d48", wash: "#ffedf2", soft: "#fff6f8", border: "#ffc9d6" },
  bamboohr: COMPANY_COLOR_THEMES[3],
  "bamboo hr": COMPANY_COLOR_THEMES[3],
};

export function getCompanyTheme(companyName: string): CompanyColorTheme {
  const normalized = companyName.trim().toLowerCase();
  const customTheme = COMPANY_CUSTOM_THEMES[normalized];
  if (customTheme) return customTheme;

  const overrideIndex = COMPANY_THEME_OVERRIDES[normalized];
  if (overrideIndex !== undefined) return COMPANY_COLOR_THEMES[overrideIndex];

  let hash = 0;
  for (const char of companyName) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return COMPANY_COLOR_THEMES[hash % COMPANY_COLOR_THEMES.length];
}
