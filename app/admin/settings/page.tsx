export default function AdminSettingsPage() {
  return (
    <div className="shell py-10 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Settings</h1>
        <p className="mt-2 text-muted-foreground">
          Configure platform-wide administrative preferences and security controls.
        </p>
      </div>

      <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-10 text-center text-sm text-muted-foreground">
        Settings management will be enabled in a follow-up release.
      </div>
    </div>
  );
}
