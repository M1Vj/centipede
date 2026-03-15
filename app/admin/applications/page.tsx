import { Suspense } from "react";
import { createAdminClient, approveOrganizerApplication, rejectOrganizerApplication } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, FileText, User, Mail, Building } from "lucide-react";
import { redirect } from "next/navigation";

async function ApplicationsList() {
  const admin = createAdminClient();
  if (!admin) return <div className="p-4 text-muted-foreground bg-muted/5 rounded-xl border border-border/20 font-medium">System is initializing. Please wait.</div>;

  const { data: applications, error } = await admin
    .from("organizer_applications")
    .select(`
      *,
      profiles!organizer_applications_user_id_fkey (full_name, email)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    return <div className="p-4 text-destructive bg-destructive/5 rounded-xl border border-destructive/20 font-medium">Failed to load applications.</div>;
  }

  if (!applications || applications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-border/60 bg-muted/20">
        <FileText className="size-10 text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground">No organizer applications found.</p>
      </div>
    );
  }

  async function handleApprove(applicationId: string, userId: string) {
    "use server";
    try {
      await approveOrganizerApplication(applicationId, userId);
    } catch (err) {
      console.error("Failed to approve application:", err);
    }
    redirect("/admin/applications");
  }

  async function handleReject(formData: FormData) {
    "use server";
    const appId = formData.get("applicationId") as string;
    const reason = formData.get("reason") as string || "Administrative rejection";
    try {
      await rejectOrganizerApplication(appId, reason);
    } catch (err) {
      console.error("Failed to reject application:", err);
    }
    redirect("/admin/applications");
  }

  return (
    <div className="space-y-4">
      {applications.map((app) => (
        <Card key={app.id} className="overflow-hidden border-border/60">
          <div className="flex flex-col md:flex-row">
            <div className="flex-1 p-6">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Badge variant={app.status === "pending" ? "default" : app.status === "approved" ? "secondary" : "destructive"}>
                    {app.status.toUpperCase()}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Applied on {new Date(app.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3 mb-6">
                <div className="flex items-center gap-2 text-sm">
                  <User className="size-4 text-muted-foreground" />
                  <span className="font-semibold">{app.profiles?.full_name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="size-4 text-muted-foreground" />
                  <span className="text-muted-foreground truncate">{app.profiles?.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Building className="size-4 text-muted-foreground" />
                  <span className="font-medium">{app.organization || "No Organization"}</span>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-primary/70 mb-2">Organizer Bio / Purpose</p>
                <p className="text-sm text-muted-foreground leading-relaxed italic border-l-2 border-primary/20 pl-4 py-1">
                  {app.bio || "No bio provided."}
                </p>
              </div>
            </div>

            {app.status === "pending" && (
              <div className="bg-muted/30 border-t md:border-t-0 md:border-l flex flex-col items-center justify-center p-6 gap-3 min-w-[200px]">
                <form action={handleApprove.bind(null, app.id, app.user_id)} className="w-full">
                  <Button type="submit" variant="default" className="w-full gap-2 shadow-sm">
                    <Check className="size-4" />
                    Approve
                  </Button>
                </form>
                <form action={handleReject} className="w-full space-y-2">
                  <input type="hidden" name="applicationId" value={app.id} />
                  <textarea 
                    name="reason" 
                    placeholder="Rejection reason..." 
                    className="w-full text-xs rounded-md border border-input bg-background px-2 py-1 focus:ring-1 focus:ring-primary outline-none h-16 resize-none"
                  />
                  <Button type="submit" variant="outline" className="w-full gap-2 text-destructive hover:bg-destructive/10">
                    <X className="size-4" />
                    Reject
                  </Button>
                </form>
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

function ApplicationSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="animate-pulse border-border/60">
          <div className="p-6 space-y-4">
            <div className="h-4 w-24 bg-muted rounded" />
            <div className="grid grid-cols-3 gap-4">
              <div className="h-4 w-full bg-muted rounded" />
              <div className="h-4 w-full bg-muted rounded" />
              <div className="h-4 w-full bg-muted rounded" />
            </div>
            <div className="h-12 w-full bg-muted rounded" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function AdminApplicationsPage() {
  return (
    <div className="shell py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Organizer Applications</h1>
        <p className="mt-2 text-muted-foreground">
          Review and process requests from users wanting to create and manage competitions.
        </p>
      </div>

      <Suspense fallback={<ApplicationSkeleton />}>
        <ApplicationsList />
      </Suspense>
    </div>
  );
}
