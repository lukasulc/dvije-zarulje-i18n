export const locales = ["hr", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "hr";
export const localeMap: Record<Locale, string> = { hr: "hr-HR", en: "en-US" };
export const languageSwitcherMap: Record<Locale, string> = { hr: "HR", en: "EN" };
export const googleAnalyticsId = "G-ZDNRL6MNKB";
