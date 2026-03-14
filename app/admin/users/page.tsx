import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Shield, ShieldAlert, Mail, Calendar, Trash2, Ban } from "lucide-react";

async function UsersList() {
  const admin = createAdminClient();
  if (!admin) return <div className="p-4 text-muted-foreground bg-muted/5 rounded-xl border border-border/20 font-medium text-center">System is initializing. Please wait.</div>;

  const { data: users, error } = await admin
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return <div className="p-4 text-destructive bg-destructive/5 rounded-xl border border-destructive/20 font-medium">Failed to load users.</div>;
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
                  <Badge variant="outline" className="text-green-600 bg-green-500/5 border-green-500/20">
                    Active
                  </Badge>
                </td>
                <td className="px-6 py-4 text-left text-muted-foreground">
                    <div className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        {new Date(user.created_at).toLocaleDateString()}
                    </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10" title="Suspend User">
                      <Ban className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="Delete User">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
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

export default function AdminUsersPage() {
  return (
    <div className="shell py-10 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="mt-2 text-muted-foreground">
            Manage permissions, moderate accounts, and monitor user activity.
          </p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" className="gap-2">
              Filter by Role
           </Button>
           <Button variant="default" className="gap-2 shadow-sm">
              Export CSV
           </Button>
        </div>
      </div>

      <Suspense fallback={<UsersSkeleton />}>
        <UsersList />
      </Suspense>
    </div>
  );
}
