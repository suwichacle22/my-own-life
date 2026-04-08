import { createFileRoute } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <main className="page-wrap px-4 py-12">
      <Card className="rounded-[2rem] p-6 sm:p-8">
        <Badge className="mb-3 w-fit">Guide</Badge>
        <h1 className="display-title mb-4 text-4xl font-bold text-[var(--sea-ink)] sm:text-5xl">
          Track one day at a time.
        </h1>
        <div className="grid gap-4 text-sm leading-7 text-[var(--sea-ink-soft)] sm:grid-cols-2">
          <Card className="rounded-2xl bg-[var(--surface-muted)]">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="text-base">Time entries</CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <CardDescription className="mb-0">
                Log how many minutes you spent and keep the category broad. The
                goal is fast capture, not perfect reconstruction.
              </CardDescription>
            </CardContent>
          </Card>
          <Card className="rounded-2xl bg-[var(--surface-muted)]">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="text-base">Money entries</CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <CardDescription className="mb-0">
                Add the amount, category, and an optional note. The daily totals
                update immediately when Convex syncs the new record.
              </CardDescription>
            </CardContent>
          </Card>
          <Card className="rounded-2xl bg-[var(--surface-muted)]">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="text-base">Phone and desktop</CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <CardDescription className="mb-0">
                Use the same app on both. The layout is stacked on mobile and
                expands into side-by-side panels on larger screens.
              </CardDescription>
            </CardContent>
          </Card>
          <Card className="rounded-2xl bg-[var(--surface-muted)]">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="text-base">Scope</CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <CardDescription className="mb-0">
                This MVP focuses on today. History, trends, and deeper analysis
                can come after you prove the daily workflow is easy enough to keep
                using.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </Card>
    </main>
  )
}
