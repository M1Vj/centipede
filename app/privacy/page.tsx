import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacyPage() {
  return (
    <section className="shell py-14 md:py-20">
      <div className="mx-auto max-w-3xl">
        <Card className="border-border/60 bg-background/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-4xl">Privacy Policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-7 text-muted-foreground">
            <p>Mathwiz Arena uses account information to authenticate users, complete profiles, and support competition workflows.</p>
            <p>We store profile, registration, and moderation data needed to operate the platform and preserve competition history.</p>
            <p>Access to account data is restricted by role, and account removal follows the platform&apos;s anonymization rules where applicable.</p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
