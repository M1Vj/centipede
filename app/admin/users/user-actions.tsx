"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Ban, Edit3, ShieldCheck, Trash2 } from "lucide-react";

export type AdminUserRecord = {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  is_active: boolean;
  school: string | null;
  grade_level: string | null;
  organization: string | null;
};

type UpdateUserPayload = {
  userId: string;
  fullName: string;
  role: string;
};

type UserActionsProps = {
  user: AdminUserRecord;
  currentUserId?: string;
  onSuspend: (userId: string) => Promise<void>;
  onReactivate: (userId: string) => Promise<void>;
  onDelete: (userId: string) => Promise<void>;
  onUpdate: (payload: UpdateUserPayload) => Promise<void>;
};

const roleOptions = [
  { value: "mathlete", label: "Mathlete" },
  { value: "organizer", label: "Organizer" },
  { value: "admin", label: "Admin" },
];

export function UserActions({
  user,
  currentUserId,
  onSuspend,
  onReactivate,
  onDelete,
  onUpdate,
}: UserActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [action, setAction] = useState<"suspend" | "reactivate" | "delete" | "update" | null>(null);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [fullName, setFullName] = useState(user.full_name ?? "");
  const [role, setRole] = useState(user.role ?? "mathlete");

  const displayName = useMemo(
    () => user.full_name || "Anonymous",
    [user.full_name],
  );

  useEffect(() => {
    setFullName(user.full_name ?? "");
    setRole(user.role ?? "mathlete");
    setDeleteConfirmText("");
  }, [user.full_name, user.role]);

  function handleSuspendConfirm() {
    setAction("suspend");
    startTransition(async () => {
      try {
        await onSuspend(user.id);
        setSuspendOpen(false);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "An error occurred.");
      } finally {
        setAction(null);
      }
    });
  }

  function handleReactivate() {
    setAction("reactivate");
    startTransition(async () => {
      try {
        await onReactivate(user.id);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "An error occurred.");
      } finally {
        setAction(null);
      }
    });
  }

  function handleDeleteConfirm() {
    setAction("delete");
    startTransition(async () => {
      try {
        await onDelete(user.id);
        setDeleteOpen(false);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "An error occurred.");
      } finally {
        setAction(null);
      }
    });
  }

  function handleUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAction("update");
    startTransition(async () => {
      try {
        await onUpdate({
          userId: user.id,
          fullName,
          role,
        });
        setDetailOpen(false);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "An error occurred.");
      } finally {
        setAction(null);
      }
    });
  }

  if (currentUserId === user.id) {
    return (
      <div className="flex justify-end">
        <span 
          className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-border/20 cursor-not-allowed"
          title="Active session cannot be modified from here."
        >
          Active Session
        </span>
      </div>
    );
  }

  return (
    <div className="flex justify-end gap-2">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
        title="Edit user details"
        onClick={() => setDetailOpen(true)}
      >
        <Edit3 className="size-4" />
      </Button>
      {user.is_active ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10"
          title="Suspend user"
          onClick={() => setSuspendOpen(true)}
        >
          <Ban className="size-4" />
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10"
          title="Reactivate user"
          onClick={handleReactivate}
          disabled={isPending}
        >
          <ShieldCheck className="size-4" />
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        title="Anonymize user account"
        onClick={() => setDeleteOpen(true)}
      >
        <Trash2 className="size-4" />
      </Button>

      <ConfirmDialog
        open={suspendOpen}
        onOpenChange={setSuspendOpen}
        title={`Suspend ${displayName}?`}
        description="Suspended users cannot log in until reactivated."
        confirmLabel="Suspend user"
        pending={isPending && action === "suspend"}
        pendingLabel="Suspending..."
        onConfirm={handleSuspendConfirm}
      />

      {deleteOpen ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-foreground/25 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border/60 bg-background p-6 shadow-[0_30px_90px_-32px_hsl(var(--shadow)/0.5)]">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-rose-600">Irreversible anonymization</p>
              <h2 className="text-xl font-semibold">Anonymize {displayName}?</h2>
              <p className="text-sm text-muted-foreground">
                This scrubs personal profile data, disables the account, and preserves historical competition records. Type DELETE to confirm.
              </p>
            </div>
            <div className="mt-4 space-y-2">
              <Input
                value={deleteConfirmText}
                onChange={(event) => setDeleteConfirmText(event.target.value)}
                placeholder="Type DELETE to confirm"
              />
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                pending={isPending && action === "delete"}
                pendingText="Anonymizing..."
                onClick={handleDeleteConfirm}
                disabled={deleteConfirmText !== "DELETE"}
              >
                Anonymize account
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {detailOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/25 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border/60 bg-background p-6 shadow-[0_30px_90px_-32px_hsl(var(--shadow)/0.5)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">User Details</p>
                <h2 className="text-xl font-semibold mt-2">{displayName}</h2>
                <p className="text-sm text-muted-foreground">Edit profile fields and permissions.</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setDetailOpen(false)}>
                X
              </Button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleUpdate}>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">Full name</label>
                <Input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">Email</label>
                <Input value={user.email} readOnly disabled />
                <p className="text-xs text-muted-foreground">
                  Email stays immutable here so profile data remains consistent with authentication credentials.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">Role</label>
                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setDetailOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" pending={isPending && action === "update"} pendingText="Saving...">
                  Save changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
