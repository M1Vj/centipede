import { Suspense } from "react";
import {
  createAdminClient,
  approveOrganizerApplication,
  rejectOrganizerApplication,
} from "@/lib/supabase/admin";
import {
  prepareOrganizerIdentityForApproval,
  processOrganizerDecisionHandoff,
} from "@/lib/organizer/lifecycle";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, User, Mail, Building } from "lucide-react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getErrorMessage } from "@/lib/errors";
import {
  checkOrganizerProvisioning,
  needsProvisioningRetry,
  type OrganizerProvisioningSnapshot,
} from "@/lib/admin/organizer-provisioning";
import { ApproveButton, RejectButton, RetryProvisioningButton } from "./application-actions";

type ApplicationProfile = {
  full_name: string | null;
  email: string | null;
  organization: string | null;
  role: string | null;
  approved_at: string | null;
};

type OrganizerApplicationRecord = {
  id: string;
  status: "pending" | "approved" | "rejected";
  submitted_at: string;
  profile_id: string | null;
  applicant_full_name: string | null;
  contact_email: string | null;
  organization_name: string | null;
  statement: string | null;
  profiles: ApplicationProfile | ApplicationProfile[] | null;
};

type ProvisioningApplicationRecord = {
  status: "pending" | "approved" | "rejected";
  profile_id: string | null;
  profiles: ApplicationProfile | ApplicationProfile[] | null;
};

function buildFeedbackRedirect(type: "success" | "error", message: string) {
  const params = new URLSearchParams();
  params.set("feedback", type);
  params.set("message", message.trim().slice(0, 240));
  return `/admin/applications?${params.toString()}`;
}

function toPublicActionErrorMessage(error: unknown, fallback: string) {
  const message = getErrorMessage(error, "").trim();
  const normalized = message.toLowerCase();

  if (!message) {
    return fallback;
  }

  if (normalized.includes("unauthorized")) {
    return "Unauthorized: Admin access required.";
  }

  if (
    normalized.includes("application not found") ||
    normalized.includes("missing application id")
  ) {
    return "Application record could not be found.";
  }

  if (
    normalized.includes("only pending applications") ||
    normalized.includes("cannot be approved") ||
    normalized.includes("cannot be rejected")
  ) {
    return "Only pending applications can be reviewed.";
  }

  if (
    normalized.includes("linked profile") ||
    normalized.includes("identity provisioning") ||
    normalized.includes("profile email")
  ) {
    return "Unable to complete organizer provisioning right now. Verify profile linkage and contact email, then retry.";
  }

  if (normalized.includes("contact email")) {
    return "Application contact email is required before this action can continue.";
  }

  if ((error as Record<string, unknown>)?.__isAuthError) {
    return message;
  }

  return fallback;
}

function resolveApplicationProfile(application: ProvisioningApplicationRecord) {
  if (!application.profiles) {
    return null;
  }

  if (Array.isArray(application.profiles)) {
    return application.profiles[0] ?? null;
  }

  return application.profiles;
}

function buildProvisioningSnapshot(
  application: ProvisioningApplicationRecord,
): OrganizerProvisioningSnapshot {
  const profile = resolveApplicationProfile(application);

  return {
    status: application.status,
    profileId: application.profile_id,
    hasLinkedProfile: Boolean(profile),
    profileRole: profile?.role ?? null,
    profileApprovedAt: profile?.approved_at ?? null,
  };
}

async function ApplicationsList() {
  const admin = createAdminClient();
  if (!admin) return <div className="p-4 text-muted-foreground bg-muted/5 rounded-xl border border-border/20 font-medium">System is initializing. Please wait.</div>;

  const { data: applications, error } = await admin
    .from("organizer_applications")
    .select(`
      *,
      profiles:profile_id (full_name, email, organization, role, approved_at)
    `)
    .in("status", ["pending", "approved"])
    .order("submitted_at", { ascending: false });

  const visibleApplications = ((applications ?? []) as OrganizerApplicationRecord[]).filter(
    (application) =>
      application.status === "pending" || needsProvisioningRetry(buildProvisioningSnapshot(application)),
  );

  if (error) {
    return <div className="p-4 text-destructive bg-destructive/5 rounded-xl border border-destructive/20 font-medium">Failed to load applications.</div>;
  }

  if (visibleApplications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-border/60 bg-muted/20">
        <FileText className="size-10 text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground">No organizer applications found.</p>
      </div>
    );
  }

  async function requireAdminActor() {
    "use server";

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Unauthorized");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle<{ role: string | null }>();

    if (profileError) {
      throw new Error("Unable to verify admin permissions.");
    }

    if (profile?.role !== "admin") {
      throw new Error("Unauthorized: Admin access required");
    }

    return user.id;
  }

  async function verifyProvisioningCompletion(applicationId: string) {
    "use server";

    const admin = createAdminClient();
    if (!admin) {
      throw new Error("Unable to verify organizer provisioning right now. Retry provisioning.");
    }

    const { data: application, error: applicationError } = await admin
      .from("organizer_applications")
      .select("status, profile_id, profiles:profile_id (role, approved_at)")
      .eq("id", applicationId)
      .maybeSingle<ProvisioningApplicationRecord>();

    if (applicationError) {
      throw new Error("Unable to verify organizer provisioning status. Retry provisioning.");
    }

    if (!application) {
      throw new Error("Application record was not found during provisioning verification.");
    }

    const verification = checkOrganizerProvisioning(buildProvisioningSnapshot(application));
    if (!verification.ok) {
      throw new Error(`${verification.message} If this persists, verify profile linkage and contact email.`);
    }
  }

  async function handleApprove(formData: FormData) {
    "use server";

    const applicationId = formData.get("applicationId");
    const profileId = formData.get("profileId");

    if (typeof applicationId !== "string" || !applicationId.trim()) {
      redirect(buildFeedbackRedirect("error", "Missing application id."));
    }

    const normalizedProfileId =
      typeof profileId === "string" && profileId.trim() ? profileId.trim() : undefined;

    try {
      const actorId = await requireAdminActor();
      const identity = await prepareOrganizerIdentityForApproval(
        applicationId,
        normalizedProfileId,
      );
      await approveOrganizerApplication(applicationId, identity.profileId, actorId);
      await processOrganizerDecisionHandoff(applicationId, {
        skipProvisioning: true,
        invitedIdentity: identity.invitedIdentity,
      });
      await verifyProvisioningCompletion(applicationId);
      revalidatePath("/admin/applications");
    } catch (error) {
      revalidatePath("/admin/applications");
      redirect(
        buildFeedbackRedirect(
          "error",
          toPublicActionErrorMessage(error, "Failed to approve application."),
        ),
      );
    }

    redirect(buildFeedbackRedirect("success", "Application approved and organizer handoff completed."));
  }

  async function handleReject(formData: FormData) {
    "use server";

    const appId = formData.get("applicationId");
    const reason = formData.get("reason");

    if (typeof appId !== "string" || !appId.trim()) {
      redirect(buildFeedbackRedirect("error", "Missing application id."));
    }

    const normalizedReason =
      typeof reason === "string" && reason.trim()
        ? reason.trim()
        : "Administrative rejection";

    try {
      const actorId = await requireAdminActor();
      await rejectOrganizerApplication(appId, normalizedReason, actorId);
      await processOrganizerDecisionHandoff(appId);
      revalidatePath("/admin/applications");
    } catch (error) {
      revalidatePath("/admin/applications");
      redirect(
        buildFeedbackRedirect(
          "error",
          toPublicActionErrorMessage(error, "Failed to reject application."),
        ),
      );
    }

    redirect(buildFeedbackRedirect("success", "Application rejected and notification handoff completed."));
  }

  async function handleRetryHandoff(formData: FormData) {
    "use server";

    const appId = formData.get("applicationId");

    if (typeof appId !== "string" || !appId.trim()) {
      redirect(buildFeedbackRedirect("error", "Missing application id."));
    }

    try {
      await requireAdminActor();
      await processOrganizerDecisionHandoff(appId);
      await verifyProvisioningCompletion(appId);
      revalidatePath("/admin/applications");
    } catch (error) {
      revalidatePath("/admin/applications");
      redirect(
        buildFeedbackRedirect(
          "error",
          toPublicActionErrorMessage(error, "Failed to retry organizer provisioning."),
        ),
      );
    }

    redirect(buildFeedbackRedirect("success", "Organizer provisioning handoff retried."));
  }

  return (
    <div className="space-y-4">
      {visibleApplications.map((app) => {
        const profile = resolveApplicationProfile(app);
        const shouldShowRetry =
          app.status === "approved" && needsProvisioningRetry(buildProvisioningSnapshot(app));

        return (
          <Card key={app.id} className="overflow-hidden border-border/60">
            <div className="flex flex-col md:flex-row">
              <div className="flex-1 p-6">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Badge variant={app.status === "pending" ? "default" : app.status === "approved" ? "secondary" : "destructive"}>
                      {app.status.toUpperCase()}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Applied on {new Date(app.submitted_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3 mb-6">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="size-4 text-muted-foreground" />
                    <span className="font-semibold">{app.applicant_full_name || profile?.full_name || "Unknown applicant"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="size-4 text-muted-foreground" />
                    <span className="text-muted-foreground truncate">{app.contact_email || profile?.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Building className="size-4 text-muted-foreground" />
                    <span className="font-medium">{app.organization_name || profile?.organization || "No Organization"}</span>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-primary/70 mb-2">Organizer Bio / Purpose</p>
                  <p className="text-sm text-muted-foreground leading-relaxed italic border-l-2 border-primary/20 pl-4 py-1">
                    {app.statement || "No statement provided."}
                  </p>
                </div>
              </div>

              {app.status === "pending" && (
                <div className="bg-muted/30 border-t md:border-t-0 md:border-l flex flex-col items-center justify-center p-6 gap-3 min-w-[200px]">
                  <form action={handleApprove} className="w-full">
                    <input type="hidden" name="applicationId" value={app.id} />
                    {app.profile_id ? <input type="hidden" name="profileId" value={app.profile_id} /> : null}
                    <ApproveButton />
                  </form>
                  <form action={handleReject} className="w-full space-y-2">
                    <input type="hidden" name="applicationId" value={app.id} />
                    <textarea
                      name="reason"
                      placeholder="Rejection reason..."
                      className="w-full text-xs rounded-md border border-input bg-background px-2 py-1 focus:ring-1 focus:ring-primary outline-none h-16 resize-none"
                    />
                    <RejectButton />
                  </form>
                </div>
              )}

              {shouldShowRetry && (
                <div className="bg-muted/30 border-t md:border-t-0 md:border-l flex flex-col items-center justify-center p-6 gap-3 min-w-[240px]">
                  <p className="text-xs text-center text-muted-foreground">
                    Approved, but organizer activation is not complete yet.
                  </p>
                  <form action={handleRetryHandoff} className="w-full">
                    <input type="hidden" name="applicationId" value={app.id} />
                    <RetryProvisioningButton />
                  </form>
                </div>
              )}
            </div>
          </Card>
        );
      })}
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

export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = (await searchParams) || {};
  const getSingle = (param: string | string[] | undefined, fallback: string) =>
    typeof param === "string" ? param : (Array.isArray(param) ? param[0] || fallback : fallback);

  const feedback = getSingle(resolvedSearchParams.feedback, "");
  const feedbackMessage = getSingle(resolvedSearchParams.message, "").trim().slice(0, 240);
  const isSuccessFeedback = feedback === "success";
  const hasFeedback = (feedback === "success" || feedback === "error") && feedbackMessage.length > 0;

  return (
    <div className="shell py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Organizer Applications</h1>
        <p className="mt-2 text-muted-foreground">
          Review and process requests from users wanting to create and manage competitions.
        </p>
      </div>

      {hasFeedback && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-medium ${
            isSuccessFeedback
              ? "border-green-500/30 bg-green-500/10 text-green-700"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          {feedbackMessage}
        </div>
      )}

      <Suspense fallback={<ApplicationSkeleton />}>
        <ApplicationsList />
      </Suspense>
    </div>
  );
}
