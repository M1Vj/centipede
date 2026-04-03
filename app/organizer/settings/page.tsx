import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProgressLink } from "@/components/ui/progress-link";
import { getWorkspaceContext } from "@/lib/auth/workspace";
import {
  getOrganizerSettingsSnapshot,
  saveOrganizerSettings,
} from "@/lib/organizer/settings";

async function updateOrganizerSettings(formData: FormData) {
  "use server";

  await saveOrganizerSettings({
    contactPhone: String(formData.get("contact_phone") ?? ""),
    organizationType: String(formData.get("organization_type") ?? ""),
  });

  revalidatePath("/organizer/settings");
  redirect("/organizer/settings");
}

export default async function OrganizerSettingsPage() {
  const { profile, userEmail } = await getWorkspaceContext({ requireRole: "organizer" });
  const snapshot = profile?.id
    ? await getOrganizerSettingsSnapshot(profile.id)
    : { contactPhone: "", organizationType: "" };

  return (
    <section className="shell py-14 md:py-20">
      <div className="mx-auto max-w-2xl">
        <Card className="border-border/60 bg-background/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-3xl">Organizer settings</CardTitle>
            <CardDescription>
              Update organization-facing contact settings. Login identifier is immutable in self-service.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateOrganizerSettings} className="space-y-5">
              <div className="grid gap-2">
                <Label htmlFor="login_identifier">Login identifier (immutable)</Label>
                <Input
                  id="login_identifier"
                  value={userEmail || profile?.email || ""}
                  disabled
                  readOnly
                />
                <p className="text-xs text-muted-foreground">
                  To recover access, use{" "}
                  <ProgressLink href="/auth/forgot-password" className="font-semibold text-primary underline-offset-4 hover:underline">
                    password recovery
                  </ProgressLink>
                  .
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contact_phone">Contact phone</Label>
                <Input
                  id="contact_phone"
                  name="contact_phone"
                  defaultValue={snapshot.contactPhone}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="organization_type">Organization type</Label>
                <Input
                  id="organization_type"
                  name="organization_type"
                  defaultValue={snapshot.organizationType}
                  required
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit">Save settings</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
