import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getWorkspaceContext } from "@/lib/auth/workspace";
import { saveOrganizerProfile } from "@/lib/organizer/settings";

async function updateOrganizerProfile(formData: FormData) {
  "use server";

  await saveOrganizerProfile({
    fullName: String(formData.get("full_name") ?? ""),
    organization: String(formData.get("organization") ?? ""),
  });

  revalidatePath("/organizer");
  revalidatePath("/organizer/profile");
  redirect("/organizer/profile");
}

export default async function OrganizerProfilePage() {
  const { profile, userEmail } = await getWorkspaceContext({ requireRole: "organizer" });

  return (
    <section className="shell py-14 md:py-20">
      <div className="mx-auto max-w-2xl">
        <Card className="border-border/60 bg-background/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-3xl">Organizer profile</CardTitle>
            <CardDescription>
              Keep your organizer identity and organization details up to date.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateOrganizerProfile} className="space-y-5">
              <div className="grid gap-2">
                <Label htmlFor="full_name">Full name</Label>
                <Input id="full_name" name="full_name" defaultValue={profile?.full_name ?? ""} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="organization">Organization</Label>
                <Input
                  id="organization"
                  name="organization"
                  defaultValue={profile?.organization ?? ""}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="login_identifier">Login identifier (immutable)</Label>
                <Input
                  id="login_identifier"
                  value={userEmail || profile?.email || ""}
                  disabled
                  readOnly
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit">Save profile</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
