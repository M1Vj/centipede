import { Suspense } from "react";
import {
  createAdminClient,
  purgeUser,
  setUserActiveStatus,
  updateUserProfile,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { ProgressLink } from "@/components/ui/progress-link";
import type { AdminUserRecord } from "./user-actions";
import { UserActions } from "./user-actions";
import { revalidatePath } from "next/cache";
import { User, Shield, ShieldAlert, Mail, Calendar } from "lucide-react";
import {
  mergeDedupeSortUsersByCreatedAtDesc,
  sanitizeUserSearchTerm,
} from "@/lib/admin/user-search";

type FilterParams = {
  role?: string;
  status?: string;
  search?: string;
};

type UsersListRecord = AdminUserRecord & {
  created_at: string | null;
};

async function UsersList({ role, status, search }: FilterParams) {
  const admin = createAdminClient();
  const supabase = await createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  
  if (!admin) return <div className="p-4 text-muted-foreground bg-muted/5 rounded-xl border border-border/20 font-medium text-center">System is initializing. Please wait.</div>;

  const sanitizedSearch = search ? sanitizeUserSearchTerm(search) : "";
  const createFilteredQuery = () => {
    let query = admin
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (status === "anonymized") {
      query = query.like("email", "%@anon.invalid");
    } else {
      query = query.not("email", "like", "%@anon.invalid");
    }

    if (role && role !== "all") {
      query = query.eq("role", role);
    }

    if (status === "active") {
      query = query.eq("is_active", true);
    }

    if (status === "suspended") {
      query = query.eq("is_active", false);
    }

    return query;
  };

  let users: UsersListRecord[] | null = null;
  let error: Error | null = null;

  if (!sanitizedSearch) {
    const result = await createFilteredQuery();
    users = (result.data as UsersListRecord[] | null) ?? null;
    error = result.error;
  } else {
    const wildcardSearch = `%${sanitizedSearch}%`;

    const [nameResult, emailResult] = await Promise.all([
      createFilteredQuery().ilike("full_name", wildcardSearch),
      createFilteredQuery().ilike("email", wildcardSearch),
    ]);

    if (nameResult.error || emailResult.error) {
      error = (nameResult.error ?? emailResult.error) as Error;
    } else {
      users = mergeDedupeSortUsersByCreatedAtDesc(
        (nameResult.data as UsersListRecord[] | null) ?? [],
        (emailResult.data as UsersListRecord[] | null) ?? [],
      );
    }
  }

  if (error) {
    return <div className="p-4 text-destructive bg-destructive/5 rounded-xl border border-destructive/20 font-medium">Failed to load users.</div>;
  }

  async function suspendUser(userId: string) {
    "use server";
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");
    
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") throw new Error("Unauthorized: Admin access required");
    
    if (userId === user.id) throw new Error("You cannot suspend your own account.");

    await setUserActiveStatus(userId, false, user.id);
    revalidatePath("/admin/users");
  }

  async function reactivateUser(userId: string) {
    "use server";
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");
    
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") throw new Error("Unauthorized: Admin access required");

    if (userId === user.id) throw new Error("You cannot reactivate your own account.");

    await setUserActiveStatus(userId, true, user.id);
    revalidatePath("/admin/users");
  }

  async function deleteUser(userId: string) {
    "use server";
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") throw new Error("Unauthorized: Admin access required");

    if (userId === user.id) throw new Error("You cannot delete your own account.");

    await purgeUser(userId, user.id);
    revalidatePath("/admin/users");
  }

  async function saveUser(payload: {
    userId: string;
    fullName: string;
    role: string;
  }) {
    "use server";
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") throw new Error("Unauthorized: Admin access required");

    if (payload.userId === user.id) {
      throw new Error("You cannot modify your own role or account from the dashboard.");
    }

    const normalizedRole = payload.role.trim();
    if (!["mathlete", "organizer", "admin"].includes(normalizedRole)) {
      throw new Error("Unsupported role value.");
    }

    await updateUserProfile({
      userId: payload.userId,
      fullName: payload.fullName,
      role: normalizedRole,
      actorId: user.id,
    });
    revalidatePath("/admin/users");
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-background overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 border-b border-border/60 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="px-6 py-4">User</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Joined</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {users?.map((user) => (
              <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4 text-left">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <User className="size-4" />
                    </div>
                    <div>
                      <p className="font-semibold">{user.full_name || "Anonymous"}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Mail className="size-3" />
                        {user.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-left">
                  <div className="flex items-center gap-2">
                    {user.role === "admin" ? (
                      <Badge variant="default" className="bg-red-500 hover:bg-red-600 text-white border-0 gap-1">
                        <ShieldAlert className="size-3" />
                        ADMIN
                      </Badge>
                    ) : user.role === "organizer" ? (
                      <Badge variant="secondary" className="gap-1">
                        <Shield className="size-3" />
                        ORGANIZER
                      </Badge>
                    ) : (
                      <Badge variant="outline">MATHLETE</Badge>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-left">
                  <Badge
                    variant="outline"
                    className={
                      user.is_active
                        ? "text-green-600 bg-green-500/5 border-green-500/20"
                        : "text-amber-600 bg-amber-500/10 border-amber-500/20"
                    }
                  >
                    {user.is_active ? "Active" : "Suspended"}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-left text-muted-foreground">
                    <div className="flex items-center gap-1">
                        <Calendar className="size-3" />
                    {user.created_at ? new Date(user.created_at).toLocaleDateString() : "Unknown"}
                    </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <UserActions
                    user={user as AdminUserRecord}
                    currentUserId={currentUser?.id}
                    onSuspend={suspendUser}
                    onReactivate={reactivateUser}
                    onDelete={deleteUser}
                    onUpdate={saveUser}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UsersSkeleton() {
  return (
    <div className="rounded-2xl border border-border/60 bg-background animate-pulse overflow-hidden">
        <div className="h-12 bg-muted/50 border-b border-border/60" />
        {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 border-b border-border/40" />
        ))}
    </div>
  );
}

function FilterPill({ href, label, isActive }: { href: string; label: string; isActive: boolean }) {
  return (
    <ProgressLink
      href={href}
      className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
        isActive
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border/60 text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </ProgressLink>
  );
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = (await searchParams) || {};
  const getSingle = (param: string | string[] | undefined, fallback: string) => 
    typeof param === 'string' ? param : (Array.isArray(param) ? param[0] || fallback : fallback);
    
  const role = getSingle(resolvedSearchParams.role, "all");
  const status = getSingle(resolvedSearchParams.status, "all");
  const search = getSingle(resolvedSearchParams.search, "");

  const buildHref = (nextRole: string, nextStatus: string, nextSearch: string) => {
    const params = new URLSearchParams();
    if (nextRole !== "all") params.set("role", nextRole);
    if (nextStatus !== "all") params.set("status", nextStatus);
    if (nextSearch) params.set("search", nextSearch);
    const query = params.toString();
    return query ? `/admin/users?${query}` : "/admin/users";
  };

  const roleFilters = [
    { value: "all", label: "All Roles" },
    { value: "mathlete", label: "Mathletes" },
    { value: "organizer", label: "Organizers" },
    { value: "admin", label: "Admins" },
  ];

  const statusFilters = [
    { value: "all", label: "All Status" },
    { value: "active", label: "Active" },
    { value: "suspended", label: "Suspended" },
    { value: "anonymized", label: "Anonymized" },
  ];

  return (
    <div className="shell py-10 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="mt-2 text-muted-foreground">
            Manage permissions, moderate accounts, and monitor user activity.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {roleFilters.map((filter) => (
            <FilterPill
              key={`role-${filter.value}`}
              href={buildHref(filter.value, status, search)}
              label={filter.label}
              isActive={role === filter.value}
            />
          ))}
          {statusFilters.map((filter) => (
            <FilterPill
              key={`status-${filter.value}`}
              href={buildHref(role, filter.value, search)}
              label={filter.label}
              isActive={status === filter.value}
            />
          ))}
        </div>
      </div>

      <form action="/admin/users" method="get" className="flex flex-wrap gap-3 items-center">
        <input type="hidden" name="role" value={role} />
        <input type="hidden" name="status" value={status} />
        <div className="relative w-full max-w-sm">
          <input
            name="search"
            defaultValue={search}
            placeholder="Search by name or email..."
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <button
          type="submit"
          className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90"
        >
          Search
        </button>
      </form>

      <Suspense fallback={<UsersSkeleton />}>
        <UsersList role={role} status={status} search={search} />
      </Suspense>
    </div>
  );
}
