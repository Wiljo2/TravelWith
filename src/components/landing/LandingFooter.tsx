const YEAR = new Date().getFullYear();

export function LandingFooter() {
  return (
    <footer className="border-t border-border py-8">
      <p className="mx-auto w-full max-w-6xl px-4 text-center text-sm text-muted-foreground sm:px-6">
        © {YEAR} TravelWith · Hecho para viajar en grupo
      </p>
    </footer>
  );
}
