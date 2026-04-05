import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TermsPage() {
  return (
    <section className="shell py-14 md:py-20">
      <div className="mx-auto max-w-3xl">
        <Card className="border-border/60 bg-background/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-4xl">Terms of Service</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-7 text-muted-foreground">
            <p>Mathwiz Arena provides a competition platform for mathletes, organizers, and administrators.</p>
            <p>Users must keep their accounts accurate, respect competition rules, and use the service in accordance with organizer instructions.</p>
            <p>The platform may suspend or restrict access for abuse, fraud, or policy violations.</p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
