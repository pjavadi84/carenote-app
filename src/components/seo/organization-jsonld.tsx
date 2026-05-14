// Server-rendered JSON-LD that gives Google an unambiguous entity for
// the "Kinroster" brand name. Using a @graph lets one script declare
// both the Organization and the SoftwareApplication that the
// organization publishes, and link them via `publisher`.
//
// Verify with https://search.google.com/test/rich-results after deploy.

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://kinroster.com";

export function OrganizationJsonLd() {
  const organization = {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: "Kinroster",
    url: SITE_URL,
    logo: `${SITE_URL}/logo.svg`,
    description:
      "Kinroster builds AI-powered documentation for residential care homes, turning caregiver voice notes into structured shift logs, incident reports, and family updates.",
  };

  const application = {
    "@type": "SoftwareApplication",
    "@id": `${SITE_URL}/#software`,
    name: "Kinroster",
    url: SITE_URL,
    applicationCategory: "HealthApplication",
    operatingSystem: "Web",
    description:
      "Voice-first documentation tool for residential care homes with HIPAA-ready architecture, audit ledgers, and 42 CFR Part 2 segregation.",
    publisher: { "@id": `${SITE_URL}/#organization` },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/PreOrder",
    },
  };

  const graph = {
    "@context": "https://schema.org",
    "@graph": [organization, application],
  };

  return (
    <script
      type="application/ld+json"
      // JSON.stringify safely escapes the payload; no user input flows
      // through this component, so dangerouslySetInnerHTML is fine here.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
