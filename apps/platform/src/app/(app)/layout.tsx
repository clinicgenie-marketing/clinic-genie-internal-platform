import { signOut } from "@/lib/auth";
import { requireAccess } from "@/lib/session";
import { canManageUsers } from "@clinic-genie/db";
import { Shell, type NavItem } from "@/components/shell/Shell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const access = await requireAccess();
  const workspace: NavItem[] = [
    { href: "/", label: "Dashboard", icon: "LayoutDashboard" },
    { href: "/my-tasks", label: "My tasks", icon: "ListChecks" },
    { href: "/clients", label: "Clients", icon: "Building2" },
    { href: "/approvals", label: "Approvals", icon: "CheckSquare" },
  ];
  const modules: NavItem[] = [
    { href: "/seo", label: "SEO", icon: "Search" },
    { href: "/google-ads", label: "Google Ads", icon: "Megaphone" },
    { href: "/issues", label: "Issues", icon: "AlertTriangle" },
    { href: "/medical-review", label: "Medical review", icon: "Stethoscope" },
    { href: "/reports", label: "Reports", icon: "BarChart3" },
    { href: "/timeline", label: "Timeline", icon: "History" },
  ];
  const platform: NavItem[] = canManageUsers(access) ? [{ href: "/admin", label: "Admin", icon: "Shield" }] : [];
  const envLabel = process.env.APP_ENVIRONMENT_LABEL || "development";

  async function doSignOut() {
    "use server";
    await signOut({ redirectTo: "/sign-in" });
  }

  const header = (
    <>
      <Badge tone={envLabel === "production" ? "good" : "warn"}>{envLabel}</Badge>
      <span className="hidden sm:inline text-sm text-muted truncate">
        {access.user.display_name} <span className="text-xs">({access.user.platform_role.replace("_", " ")})</span>
      </span>
      <form action={doSignOut}>
        <Button type="submit" variant="ghost" size="sm">Sign out</Button>
      </form>
    </>
  );
  return (
    <Shell workspace={workspace} modules={modules} platform={platform} header={header}>
      {children}
    </Shell>
  );
}
