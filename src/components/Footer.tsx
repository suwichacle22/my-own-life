export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-12 border-t border-[var(--line)] px-4 pb-14 pt-8 text-[var(--sea-ink-soft)] sm:mt-20 sm:pt-10">
      <div className="page-wrap flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
        <p className="m-0 text-sm">&copy; {year} My Own Life.</p>
        <p className="island-kicker m-0">Daily time and money tracker</p>
      </div>
    </footer>
  )
}
