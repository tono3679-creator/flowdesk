import { BackLink } from "@/components/common/detail";
import { PageHeader } from "@/components/common/page-header";
import { InquiryForm } from "@/components/inquiries/inquiry-form";
import { requireUser } from "@/lib/auth";
import { getLookups } from "@/lib/data/lookups";
import { inquiryFormOptions } from "@/lib/data/form-options";
import { toDateTimeLocal } from "@/lib/format";
import type { InquiryInput } from "@/lib/validation";

export const metadata = { title: "問い合わせを登録" };

export default async function NewInquiryPage() {
  const user = await requireUser();
  const lookups = await getLookups();
  const initial: InquiryInput = {
    received_at: toDateTimeLocal(new Date()), customer_id: "", create_customer: false, source_id: "", category: "", title: "", content: "",
    contact_name: "", company_name: "", phone: "", email: "", owner_id: user.isManager ? "" : user.userId, priority: "medium", status: "new",
    next_action_on: "", memo: "",
  };
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <BackLink href="/inquiries" label="問い合わせ一覧" />
      <PageHeader title="問い合わせを登録" description={`受付から${user.settings.unansweredHours}時間たっても対応履歴がないと、未対応アラートでお知らせします`} />
      <InquiryForm id={null} initial={initial} initialCustomerLabel={null} options={inquiryFormOptions(user, lookups)} />
    </div>
  );
}
