import { DemoBanner } from "@/components/layout/demo-banner";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { asCurrentUser, requireUser } from "@/lib/auth";
import { loadAlertInput } from "@/lib/data/facts";
import { detectAlerts } from "@/lib/domain/alerts";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const input = await asCurrentUser((tx) => loadAlertInput(tx));
  const alerts = detectAlerts(input, user.settings, new Date(), user.settings.timezone);
  const badges = {
    unanswered: input.inquiries.filter((i) => i.status === "new").length,
    alerts: alerts.length,
    overdue: alerts.filter((a) => a.kind === "task_overdue").length,
  };
  return (
    <div className="min-h-dvh">
      <Sidebar organizationName={user.organizationName} role={user.role} badges={badges} />
      <div className="flex min-h-dvh flex-col lg:pl-60">
        {user.isDemo && <DemoBanner role={user.role} />}
        <Header
          displayName={user.displayName}
          title={user.title}
          role={user.role}
          organizationName={user.organizationName}
          isDemo={user.isDemo}
          badges={badges}
        />
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>
    </div>
  );
}
