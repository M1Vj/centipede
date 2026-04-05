"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useId, useMemo, useState, useTransition } from "react";
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
  const deleteConfirmFieldId = useId();
  const fullNameFieldId = useId();
  const roleFieldId = useId();

  const displayName = useMemo(
    () => user.full_name || "Anonymous",
    [user.full_name],
  );

  const isAnonymized = user.email.endsWith("@anon.invalid");

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

  if (isAnonymized) {
    return (
      <div className="flex justify-end gap-2 pr-1 pt-1">
        <span 
          className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-border/20 cursor-not-allowed"
          title="This account has been anonymized and scrubbed of details."
        >
          Anonymized
        </span>
      </div>
    );
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
        aria-label="Edit user details"
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
          aria-label="Suspend user"
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
          aria-label="Reactivate user"
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
        aria-label="Anonymize user account"
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

      <AlertDialog.Root
        open={deleteOpen}
        onOpenChange={(nextOpen) => {
          if (isPending && action === "delete" && !nextOpen) {
            return;
          }

          setDeleteOpen(nextOpen);
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-[110] bg-foreground/25 backdrop-blur-sm" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[120] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border/60 bg-background p-6 shadow-[0_30px_90px_-32px_hsl(var(--shadow)/0.5)]">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-rose-600">Irreversible anonymization</p>
              <AlertDialog.Title className="text-xl font-semibold">Anonymize {displayName}?</AlertDialog.Title>
              <AlertDialog.Description className="text-sm text-muted-foreground">
                This scrubs personal profile data, disables the account, and preserves historical competition records. Type DELETE to confirm.
              </AlertDialog.Description>
            </div>

            <div className="mt-4 space-y-2">
              <label htmlFor={deleteConfirmFieldId} className="text-xs font-semibold text-muted-foreground">
                Confirmation keyword
              </label>
              <Input
                id={deleteConfirmFieldId}
                value={deleteConfirmText}
                onChange={(event) => setDeleteConfirmText(event.target.value)}
                placeholder="Type DELETE to confirm"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <Button type="button" variant="outline" disabled={isPending && action === "delete"}>
                  Cancel
                </Button>
              </AlertDialog.Cancel>
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
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>

      <Dialog.Root
        open={detailOpen}
        onOpenChange={(nextOpen) => {
          if (isPending && action === "update" && !nextOpen) {
            return;
          }

          setDetailOpen(nextOpen);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] bg-foreground/25 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[110] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border/60 bg-background p-6 shadow-[0_30px_90px_-32px_hsl(var(--shadow)/0.5)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">User Details</p>
                <Dialog.Title className="mt-2 text-xl font-semibold">{displayName}</Dialog.Title>
                <Dialog.Description className="text-sm text-muted-foreground">
                  Edit profile fields and permissions.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <Button type="button" variant="ghost" size="icon" aria-label="Close user details dialog">
                  X
                </Button>
              </Dialog.Close>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleUpdate}>
              <div className="space-y-2">
                <label htmlFor={fullNameFieldId} className="text-xs font-semibold text-muted-foreground">
                  Full name
                </label>
                <Input
                  id={fullNameFieldId}
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">Email</label>
                <Input value={user.email} readOnly disabled />
                <p className="text-xs text-muted-foreground">
                  Email stays immutable here so profile data remains consistent with authentication credentials.
                </p>
              </div>
              <div className="space-y-2">
                <label htmlFor={roleFieldId} className="text-xs font-semibold text-muted-foreground">
                  Role
                </label>
                <select
                  id={roleFieldId}
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
                <Dialog.Close asChild>
                  <Button type="button" variant="outline" disabled={isPending && action === "update"}>
                    Cancel
                  </Button>
                </Dialog.Close>
                <Button type="submit" pending={isPending && action === "update"} pendingText="Saving...">
                  Save changes
                </Button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
