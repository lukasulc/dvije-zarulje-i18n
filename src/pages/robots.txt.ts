import type { APIRoute } from "astro";
import { SITE } from "@data/client";

export const GET: APIRoute = () => {
	const sitemapLine =
		import.meta.env.PUBLIC_NOINDEX === "true" ? [] : [`Sitemap: ${SITE.url}/sitemap-index.xml`];
	const content = ["User-agent: *", "Allow: /", ...sitemapLine].join("\n");

	return new Response(`${content}\n`, {
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
};
