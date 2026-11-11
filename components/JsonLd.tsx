/**
 * Renders a <script type="application/ld+json"> block for structured data.
 * Use one per entity you want search engines to understand — WebSite on the
 * root layout, plus Article / Product / BreadcrumbList / FAQPage etc. on
 * individual pages as needed.
 *
 * https://developers.google.com/search/docs/appearance/structured-data
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
