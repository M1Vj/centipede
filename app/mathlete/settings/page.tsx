import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getWorkspaceContext } from "@/lib/auth/workspace";
import { saveMathleteSettings } from "@/lib/auth/settings";

async function updateSettings(formData: FormData) {
  "use server";

  const school = String(formData.get("school") ?? "");
  const gradeLevel = String(formData.get("grade_level") ?? "");

  await saveMathleteSettings({
    school,
    gradeLevel,
  });

  revalidatePath("/mathlete/settings");
  redirect("/mathlete");
}

export default async function MathleteSettingsPage() {
  const { profile } = await getWorkspaceContext({ requireRole: "mathlete" });

  return (
    <section className="shell py-14 md:py-20">
      <div className="mx-auto max-w-2xl">
        <Card className="border-border/60 bg-background/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-3xl">Mathlete settings</CardTitle>
            <CardDescription>
              Update your school and grade level after onboarding. Role, email, and credentials are managed elsewhere.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateSettings} className="space-y-5">
              <div className="grid gap-2">
                <Label htmlFor="school">School</Label>
                <Input id="school" name="school" defaultValue={profile?.school ?? ""} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="grade_level">Grade level</Label>
                <Input id="grade_level" name="grade_level" defaultValue={profile?.grade_level ?? ""} required />
              </div>
              <div className="flex items-center justify-end">
                <Button type="submit">Save changes</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
