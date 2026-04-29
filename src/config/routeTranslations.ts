import type { Locale } from "./siteSettings";

export const routeTranslations: Record<Locale, Record<string, string>> = {
  hr: {
    "about": "o-nama",
    "projects": "jelovnik",
    "project-1": "grill-ponuda",
    "project-2": "dnevna-ponuda",
    "reviews": "recenzije",
  },
  en: {
    "about": "about",
    "projects": "menu",
    "project-1": "grill-menu",
    "project-2": "daily-menu",
    "reviews": "reviews",
  },
};

export const localizedCollections = {} as const;
