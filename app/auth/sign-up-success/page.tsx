import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProgressLink } from "@/components/ui/progress-link";

export default function Page() {
  return (
    <AuthShell
      eyebrow="Check Email"
      title="Account created. One more confirmation step."
      description="Email confirmation keeps registration secure before participants or organizers can access protected areas."
    >
      <div className="w-full max-w-md">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                Thank you for signing up!
              </CardTitle>
              <CardDescription>Check your email to confirm</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                You&apos;ve successfully signed up. Please check your email to
                confirm your account before signing in.
              </p>
              <Button asChild variant="outline" className="mt-4 w-full">
                <ProgressLink href="/auth/login">Back to login</ProgressLink>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AuthShell>
  );
}
