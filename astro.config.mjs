import { defineConfig, fontProviders } from "astro/config";
import icon from "astro-icon";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
	site: "https://www.dvije-zarulje.hr",
	i18n: {
		defaultLocale: "hr",
		locales: ["hr", "en"],
		routing: {
			prefixDefaultLocale: false,
		},
	},
	trailingSlash: "always",
	integrations: [
		icon(),
		sitemap({
			filter: (page) => !page.includes("/admin"),
			i18n: {
				defaultLocale: "hr",
				locales: {
					hr: "hr-HR",
					en: "en-US",
				},
			},
		}),
	],
	fonts: [
		{
			provider: fontProviders.fontsource(),
			name: "Roboto",
			cssVariable: "--font-primary",
			fallbacks: ["Arial", "sans-serif"],
			weights: [400, 700, 900],
			styles: ["normal"],
			subsets: ["latin-ext", "latin"],
		},
	],
});
