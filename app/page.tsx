import type { Metadata } from "next";

// Page-level overrides merge into the root layout's metadata (template
// applies automatically: title becomes "Home | ChalkIn").
export const metadata: Metadata = {
  title: "Home",
  description:
    "Describe what this specific page offers — unique per-page descriptions matter more for SEO than the site-wide default.",
  alternates: {
    canonical: "/",
  },
};

export default function HomePage() {
  return (
    // One <h1> per page, real semantic tags (main/header/section/footer)
    // over generic <div>s — this is what crawlers and screen readers parse.
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-16">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          ChalkIn
        </h1>
        <p className="mt-2 text-neutral-500">
          Replace this with a real, keyword-relevant description of what the
          page is about. Search engines weight the first paragraph heavily.
        </p>
      </header>

      <section aria-labelledby="about-heading">
        <h2 id="about-heading" className="text-xl font-medium">
          What&apos;s already wired up
        </h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-neutral-500">
          <li>Metadata API defaults + per-page overrides (app/layout.tsx)</li>
          <li>sitemap.xml and robots.txt (app/sitemap.ts, app/robots.ts)</li>
          <li>Open Graph / Twitter card image (app/opengraph-image.tsx)</li>
          <li>JSON-LD structured data component (components/JsonLd.tsx)</li>
          <li>Semantic HTML + single-h1 page structure</li>
        </ul>
      </section>

      <footer className="mt-auto text-sm text-neutral-400">
        <p>&copy; {new Date().getFullYear()} ChalkIn</p>
      </footer>
    </main>
  );
}
