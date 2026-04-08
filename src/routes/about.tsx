import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <main className="page-wrap px-4 py-12">
      <section className="island-shell rounded-[2rem] p-6 sm:p-8">
        <p className="island-kicker mb-2">Guide</p>
        <h1 className="display-title mb-4 text-4xl font-bold text-[var(--sea-ink)] sm:text-5xl">
          Track one day at a time.
        </h1>
        <div className="grid gap-4 text-sm leading-7 text-[var(--sea-ink-soft)] sm:grid-cols-2">
          <article className="rounded-2xl border border-[var(--line)] bg-white/45 p-5">
            <h2 className="mt-0 text-base font-semibold text-[var(--sea-ink)]">
              Time entries
            </h2>
            <p className="mb-0">
              Log how many minutes you spent and keep the category broad. The
              goal is fast capture, not perfect reconstruction.
            </p>
          </article>
          <article className="rounded-2xl border border-[var(--line)] bg-white/45 p-5">
            <h2 className="mt-0 text-base font-semibold text-[var(--sea-ink)]">
              Money entries
            </h2>
            <p className="mb-0">
              Add the amount, category, and an optional note. The daily totals
              update immediately when Convex syncs the new record.
            </p>
          </article>
          <article className="rounded-2xl border border-[var(--line)] bg-white/45 p-5">
            <h2 className="mt-0 text-base font-semibold text-[var(--sea-ink)]">
              Phone and desktop
            </h2>
            <p className="mb-0">
              Use the same app on both. The layout is stacked on mobile and
              expands into side-by-side panels on larger screens.
            </p>
          </article>
          <article className="rounded-2xl border border-[var(--line)] bg-white/45 p-5">
            <h2 className="mt-0 text-base font-semibold text-[var(--sea-ink)]">
              Scope
            </h2>
            <p className="mb-0">
              This MVP focuses on today. History, trends, and deeper analysis
              can come after you prove the daily workflow is easy enough to keep
              using.
            </p>
          </article>
        </div>
      </section>
    </main>
  )
}
