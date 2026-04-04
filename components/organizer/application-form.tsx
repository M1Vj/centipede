"use client";

import { FormEvent, useMemo, useState } from "react";
import { CircleAlert, CircleCheck, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormStatusMessage } from "@/components/ui/feedback-states";
import { ProgressLink } from "@/components/ui/progress-link";
import {
  ALLOWED_LOGO_MIME_TYPES,
  MAX_LOGO_FILE_SIZE_BYTES,
} from "@/lib/organizer/constants";

type SubmissionState = {
  applicationId: string;
  statusLookupToken: string;
  statusLookupUrl: string;
  statusLookupTokenExpiresAt: string;
};

export function OrganizerApplicationForm() {
  const [applicantFullName, setApplicantFullName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [organizationType, setOrganizationType] = useState("");
  const [statement, setStatement] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [hasAcceptedDataPrivacyAct, setHasAcceptedDataPrivacyAct] = useState(false);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [status, setStatus] = useState<{
    type: "error" | "pending" | "success";
    message: string | null;
  }>({
    type: "pending",
    message: null,
  });
  const [submissionState, setSubmissionState] = useState<SubmissionState | null>(null);

  const statementWordCount = useMemo(() => {
    return statement
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
  }, [statement]);

  const validateLogoFile = (file: File | null) => {
    if (!file) {
      return;
    }

    if (!ALLOWED_LOGO_MIME_TYPES.has(file.type)) {
      throw new Error("Only JPEG and PNG logo files are allowed.");
    }

    if (file.size > MAX_LOGO_FILE_SIZE_BYTES) {
      throw new Error("Logo file size must be 2MB or less.");
    }
  };

  const fieldInvalidClass = hasAttemptedSubmit
    ? "border-destructive ring-destructive/30 focus-visible:ring-destructive/50"
    : "";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHasAttemptedSubmit(true);

    if (isSubmitting) {
      return;
    }

    const missingFields: string[] = [];
    if (!applicantFullName.trim()) missingFields.push("Full name");
    if (!organizationName.trim()) missingFields.push("Organization name");
    if (!contactEmail.trim()) missingFields.push("Contact email");
    if (!contactPhone.trim()) missingFields.push("Contact phone");
    if (!organizationType.trim()) missingFields.push("Organization type");
    if (!statement.trim()) missingFields.push("Organizer statement");
    if (!hasAcceptedDataPrivacyAct) missingFields.push("Data Privacy Act consent");
    if (!hasAcceptedTerms) missingFields.push("Terms & Conditions consent");

    if (missingFields.length > 0) {
      setStatus({
        type: "error",
        message: `Please complete the following required fields: ${missingFields.join(", ")}.`,
      });
      return;
    }

    try {
      validateLogoFile(logoFile);
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Invalid logo file.",
      });
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);
    setSubmissionState(null);
    setStatus({
      type: "pending",
      message: "Submitting your organizer application...",
    });

    const body = new FormData();
    body.set("applicantFullName", applicantFullName);
    body.set("organizationName", organizationName);
    body.set("contactEmail", contactEmail);
    body.set("contactPhone", contactPhone);
    body.set("organizationType", organizationType);
    body.set("statement", statement);
    body.set("hasAcceptedDataPrivacyAct", String(hasAcceptedDataPrivacyAct));
    body.set("hasAcceptedTerms", String(hasAcceptedTerms));

    if (logoFile) {
      body.set("logo", logoFile);
    }

    const result = await new Promise<{
      ok: boolean;
      status: number;
      payload: Record<string, unknown>;
    }>((resolve) => {
      const xhr = new XMLHttpRequest();

      xhr.open("POST", "/api/organizer/applications");
      xhr.responseType = "json";

      xhr.upload.onprogress = (progressEvent) => {
        if (!progressEvent.lengthComputable) {
          return;
        }

        const nextValue = Math.min(
          100,
          Math.round((progressEvent.loaded / progressEvent.total) * 100),
        );
        setUploadProgress(nextValue);
      };

      xhr.onload = () => {
        const payload = (xhr.response as Record<string, unknown>) || {};
        resolve({
          ok: xhr.status >= 200 && xhr.status < 300,
          status: xhr.status,
          payload,
        });
      };

      xhr.onerror = () => {
        resolve({
          ok: false,
          status: 0,
          payload: {
            message: "A network error occurred during organizer application submission.",
          },
        });
      };

      xhr.send(body);
    });

    setIsSubmitting(false);

    if (!result.ok) {
      setUploadProgress(null);
      setStatus({
        type: "error",
        message:
          typeof result.payload.message === "string"
            ? result.payload.message
            : "Unable to submit organizer application.",
      });
      return;
    }

    setUploadProgress(100);

    const nextSubmissionState: SubmissionState = {
      applicationId: String(result.payload.applicationId ?? ""),
      statusLookupToken: String(result.payload.statusLookupToken ?? ""),
      statusLookupUrl: String(result.payload.statusLookupUrl ?? ""),
      statusLookupTokenExpiresAt: String(result.payload.statusLookupTokenExpiresAt ?? ""),
    };

    setSubmissionState(nextSubmissionState);
    setStatus({
      type: "success",
      message:
        "Application submitted. Save your secure status token and monitor your review status page.",
    });
  };

  return (
    <Card className="border-border/60 bg-background/90 shadow-sm">
      <CardHeader>
        <CardTitle className="text-3xl">Organizer application</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="space-y-8" aria-busy={isSubmitting}>
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Applicant identity
            </legend>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="applicantFullName">Full name</Label>
                <Input
                  id="applicantFullName"
                  value={applicantFullName}
                  onChange={(event) => setApplicantFullName(event.target.value)}
                  required
                  className={hasAttemptedSubmit && !applicantFullName.trim() ? fieldInvalidClass : ""}
                />
                {hasAttemptedSubmit && !applicantFullName.trim() && (
                  <p className="text-xs text-destructive">Full name is required.</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="organizationName">Organization name</Label>
                <Input
                  id="organizationName"
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                  required
                  className={hasAttemptedSubmit && !organizationName.trim() ? fieldInvalidClass : ""}
                />
                {hasAttemptedSubmit && !organizationName.trim() && (
                  <p className="text-xs text-destructive">Organization name is required.</p>
                )}
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Contact details
            </legend>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="contactEmail">Contact email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  autoComplete="email"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  required
                  className={hasAttemptedSubmit && !contactEmail.trim() ? fieldInvalidClass : ""}
                />
                {hasAttemptedSubmit && !contactEmail.trim() && (
                  <p className="text-xs text-destructive">Contact email is required.</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contactPhone">Contact phone</Label>
                <Input
                  id="contactPhone"
                  value={contactPhone}
                  onChange={(event) => setContactPhone(event.target.value)}
                  className={hasAttemptedSubmit && !contactPhone.trim() ? fieldInvalidClass : ""}
                  required
                />
                {hasAttemptedSubmit && !contactPhone.trim() && (
                  <p className="text-xs text-destructive">Contact phone is required.</p>
                )}
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="organizationType">Organization type</Label>
                <Input
                  id="organizationType"
                  value={organizationType}
                  onChange={(event) => setOrganizationType(event.target.value)}
                  placeholder="School, district office, club, or academy"
                  required
                  className={hasAttemptedSubmit && !organizationType.trim() ? fieldInvalidClass : ""}
                />
                {hasAttemptedSubmit && !organizationType.trim() && (
                  <p className="text-xs text-destructive">Organization type is required.</p>
                )}
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Organizer statement
            </legend>
            <div className="grid gap-2">
              <Label htmlFor="statement">Why should your organization host competitions?</Label>
              <textarea
                id="statement"
                value={statement}
                onChange={(event) => setStatement(event.target.value)}
                className={`min-h-40 w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring ${
                  hasAttemptedSubmit && !statement.trim()
                    ? "border-destructive ring-destructive/30 focus-visible:ring-destructive/50"
                    : "border-input"
                }`}
                required
              />
              {hasAttemptedSubmit && !statement.trim() && (
                <p className="text-xs text-destructive">Organizer statement is required.</p>
              )}
              <p className="text-xs text-muted-foreground">
                Current word count: {statementWordCount}
              </p>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Organization logo (optional)
            </legend>
            <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 p-4">
              <Label htmlFor="logo" className="mb-2 inline-flex items-center gap-2">
                <Upload className="size-4" />
                Upload logo (JPEG or PNG, max 2MB)
              </Label>
              <Input
                id="logo"
                type="file"
                accept="image/jpeg,image/png"
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] ?? null;
                  setLogoFile(nextFile);
                }}
              />
              {logoFile ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Selected file: {logoFile.name}
                </p>
              ) : null}
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Legal consent
            </legend>
            <label className={`flex items-start gap-3 rounded-md border p-3 ${hasAttemptedSubmit && !hasAcceptedDataPrivacyAct ? "border-destructive bg-destructive/5" : "border-border/60"}`}>
              <input
                type="checkbox"
                checked={hasAcceptedDataPrivacyAct}
                onChange={(event) => setHasAcceptedDataPrivacyAct(event.target.checked)}
                className="mt-1"
                required
              />
              <span className="text-sm text-muted-foreground">
                I explicitly agree to the Data Privacy Act of 2012 for organizer-application processing.
              </span>
            </label>
            <label className={`flex items-start gap-3 rounded-md border p-3 ${hasAttemptedSubmit && !hasAcceptedTerms ? "border-destructive bg-destructive/5" : "border-border/60"}`}>
              <input
                type="checkbox"
                checked={hasAcceptedTerms}
                onChange={(event) => setHasAcceptedTerms(event.target.checked)}
                className="mt-1"
                required
              />
              <span className="text-sm text-muted-foreground">
                I agree to the platform Terms & Conditions for organizer operations.
              </span>
            </label>
          </fieldset>

          {uploadProgress !== null ? (
            <div className="space-y-2" aria-live="polite">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">Upload progress: {uploadProgress}%</p>
            </div>
          ) : null}

          <FormStatusMessage
            status={status.type}
            message={status.message}
            icon={status.type === "error" ? CircleAlert : status.type === "success" ? CircleCheck : undefined}
          />

          {submissionState ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm">
              <p className="font-semibold text-foreground">Save this status token now:</p>
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                {submissionState.statusLookupToken}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Expires at: {new Date(submissionState.statusLookupTokenExpiresAt).toLocaleString()}
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <ProgressLink href={`/organizer/status?token=${encodeURIComponent(submissionState.statusLookupToken)}`} className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
                  Check organizer status
                </ProgressLink>
                <a
                  href={submissionState.statusLookupUrl}
                  className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
                >
                  Open secure status link
                </a>
              </div>
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" pending={isSubmitting} pendingText="Submitting application...">
              Submit organizer application
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
