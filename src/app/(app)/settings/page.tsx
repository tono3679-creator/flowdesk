import { PageHeader } from "@/components/common/page-header";
import { GeneralForm } from "@/components/settings/general-form";
import { SourceEditor, StageEditor, TagEditor } from "@/components/settings/list-editors";
import { MemberEditor } from "@/components/settings/member-editor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireRole } from "@/lib/auth";
import { getLookups } from "@/lib/data/lookups";
import type { SettingsInput } from "@/lib/validation";

export const metadata = { title: "設定" };

const TABS = [["company", "会社・種別・優先度"], ["alerts", "アラート条件"], ["stages", "案件ステータス・確度"], ["sources", "問い合わせ経路"], ["tags", "顧客タグ"], ["members", "メンバー・権限"]] as const;

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireRole(["admin"]);
  const { tab } = await searchParams;
  const lookups = await getLookups();
  const st = user.settings;
  const initial: SettingsInput = {
    company_name: user.organizationName, industry: st.industry, timezone: "Asia/Tokyo", currency: "JPY",
    unanswered_hours: st.unansweredHours, quote_follow_days: st.quoteFollowDays, no_contact_days: st.noContactDays,
    first_response_target_hours: st.firstResponseTargetHours, inquiry_categories: st.inquiryCategories, deal_types: st.dealTypes,
    priority_labels: st.priorityLabels, auto_tasks: st.autoTasks,
  };
  const current = TABS.some(([k]) => k === tab) ? tab! : "company";
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader title="設定" description="自社の業務に合わせて、ステータス・確度・経路・アラートの条件などを変えられます（管理者のみ）" />
      <Tabs defaultValue={current} className="grid min-w-0 grid-cols-1 gap-5">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList>{TABS.map(([k, label]) => <TabsTrigger key={k} value={k}>{label}</TabsTrigger>)}</TabsList>
        </div>
        <TabsContent value="company"><GeneralForm initial={initial} section="company" /></TabsContent>
        <TabsContent value="alerts" id="alerts"><GeneralForm initial={initial} section="alerts" /></TabsContent>
        <TabsContent value="stages">
          <StageEditor initial={lookups.stages.map((s) => ({
            id: s.id, name: s.name, category: s.category, default_probability: s.defaultProbability, board_column: s.boardColumn ?? "",
            marks_quote_submitted: s.marksQuoteSubmitted, is_active: s.isActive,
          }))} />
        </TabsContent>
        <TabsContent value="sources"><SourceEditor initial={lookups.sources.map((s) => ({ id: s.id, name: s.name, is_active: s.isActive }))} /></TabsContent>
        <TabsContent value="tags"><TagEditor initial={lookups.tags.map((t) => ({ id: t.id, name: t.name, color: t.color }))} /></TabsContent>
        <TabsContent value="members"><MemberEditor members={lookups.members} currentUserId={user.userId} isDemo={user.isDemo} /></TabsContent>
      </Tabs>
    </div>
  );
}
