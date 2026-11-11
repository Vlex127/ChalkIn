import type { MetadataRoute } from "next";

const SITE_URL = "https://chalkin.com";

// List every indexable route here (or generate it dynamically from your
// CMS / database — map over slugs and return one entry per URL).
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    // {
    //   url: `${SITE_URL}/about`,
    //   lastModified: new Date(),
    //   changeFrequency: "monthly",
    //   priority: 0.8,
    // },
  ];
}
