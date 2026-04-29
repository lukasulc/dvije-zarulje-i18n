import { SITE, BUSINESS } from "@data/client";

export function getLocalBusinessSchema(origin) {
	const sameAs = [];
	if (BUSINESS.socials?.facebook) sameAs.push(BUSINESS.socials.facebook);
	if (BUSINESS.socials?.instagram) sameAs.push(BUSINESS.socials.instagram);

	const schema = {
		"@context": "https://schema.org",
		"@type": ["Restaurant", "LocalBusiness", "WebSite"],
		name: BUSINESS.name,
		url: SITE.url,
		logo: origin + BUSINESS.logo,
		image: origin + BUSINESS.logo,
		telephone: BUSINESS.phoneForTel,
		address: {
			"@type": "PostalAddress",
			streetAddress: [BUSINESS.address.lineOne, BUSINESS.address.lineTwo].filter(Boolean).join(", "),
			addressLocality: BUSINESS.address.city,
			addressRegion: BUSINESS.address.state,
			postalCode: BUSINESS.address.zip,
			addressCountry: "HR",
		},
		servesCuisine: ["Croatian", "Grill", "Bistro"],
		priceRange: "€€",
		sameAs: sameAs,
		inLanguage: SITE.locale,
	};
	if (BUSINESS.email) schema.email = BUSINESS.email;
	return schema;
}
