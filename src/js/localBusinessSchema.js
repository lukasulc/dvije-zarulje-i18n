import { SITE, BUSINESS } from "@data/client";

export function getLocalBusinessSchema(origin) {
  const sameAs = [];
  if (BUSINESS.socials?.facebook) sameAs.push(BUSINESS.socials.facebook);
  if (BUSINESS.socials?.instagram) sameAs.push(BUSINESS.socials.instagram);

  const businessId = `${SITE.url}/#restaurant`;
  const websiteId = `${SITE.url}/#website`;

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": websiteId,
        name: SITE.title,
        url: SITE.url,
        description: SITE.description,
        inLanguage: ["hr-HR", "en-US"],
        publisher: {
          "@id": businessId,
        },
      },
      {
        "@type": ["Restaurant", "LocalBusiness"],
        "@id": businessId,
        name: BUSINESS.name,
        alternateName: [
          "Dvije Zarulje",
          "2 Zarulje",
          "Dvije Žarulje",
          "2 Žarulje",
        ],
        description: SITE.description,
        url: SITE.url,
        logo: origin + BUSINESS.logo,
        image: [`${origin}/assets/social.jpg`],
        telephone: BUSINESS.phoneForTel,
        address: {
          "@type": "PostalAddress",
          streetAddress: [BUSINESS.address.lineOne, BUSINESS.address.lineTwo]
            .filter(Boolean)
            .join(", "),
          addressLocality: BUSINESS.address.city,
          addressRegion: BUSINESS.address.state,
          postalCode: BUSINESS.address.zip,
          addressCountry: "HR",
        },
        geo: {
          "@type": "GeoCoordinates",
          latitude: 45.780495,
          longitude: 15.9879,
        },
        hasMap: BUSINESS.address.mapLink,
        servesCuisine: ["Croatian", "Grill", "Bistro", "Homestyle food"],
        priceRange: "EUR",
        menu: `${SITE.url}/jelovnik/grill-ponuda/`,
        areaServed: [
          {
            "@type": "City",
            name: "Zagreb",
          },
          {
            "@type": "Place",
            name: "Sredisce",
            alternateName: "Središće",
            containedInPlace: {
              "@type": "Place",
              name: "Novi Zagreb",
            },
          },
          {
            "@type": "Place",
            name: "Bundek",
          },
        ],
        knowsAbout: [
          "grill food in Zagreb",
          "cevapi",
          "pljeskavica",
          "daily cooked meals",
          "takeaway food near Bundek",
          "lunch near Bundek Lake",
          "family lunch near Bundek Park",
        ],
        keywords:
          "Dvije Zarulje, Dvije Žarulje, grill Zagreb, rostilj Zagreb, cevapi Zagreb, daily menu Zagreb, dnevna jela Zagreb, Bundek, Sredisce, Ulica Brune Bušića 28, Ulica Brune Busica 28",
        sameAs,
        inLanguage: SITE.locale,
      },
      {
        "@type": "Place",
        "@id": `${SITE.url}/#nearby-bundek`,
        name: "Bundek Lake and Park",
        alternateName: "Jezero i park Bundek",
        description:
          "Bundek is a Novi Zagreb lake and park area near Dvije Žarulje, with walking paths, green areas and children's playgrounds.",
        containedInPlace: {
          "@type": "City",
          name: "Zagreb",
        },
      },
    ],
  };

  if (BUSINESS.email) {
    schema["@graph"][1].email = BUSINESS.email;
  }

  return schema;
}
