export default function MathleteCompetitionDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="shell py-8 md:py-10">
      {children}
    </section>
  );
}
