import { notFound } from "next/navigation";
import { BackLink } from "@/components/common/detail";
import { PageHeader } from "@/components/common/page-header";
import { InquiryForm } from "@/components/inquiries/inquiry-form";
import { requireUser } from "@/lib/auth";
import { inquiryFormOptions } from "@/lib/data/form-options";
import { getInquiry } from "@/lib/data/inquiries";
import { getLookups } from "@/lib/data/lookups";
import { toDateTimeLocal } from "@/lib/format";
import type { InquiryInput } from "@/lib/validation";

export const metadata = { title: "問い合わせを編集" };

export default async function EditInquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const [inq, lookups] = await Promise.all([getInquiry(id), getLookups()]);
  if (!inq) notFound();
  const initial: InquiryInput = {
    received_at: toDateTimeLocal(inq.receivedAt), customer_id: inq.customerId ?? "", create_customer: false, source_id: inq.sourceId ?? "",
    category: inq.category ?? "", title: inq.title, content: inq.content ?? "", contact_name: inq.contactName ?? "", company_name: inq.companyName ?? "",
    phone: inq.phone ?? "", email: inq.email ?? "", owner_id: inq.ownerId ?? "", priority: inq.priority,
    status: inq.status === "converted" ? "closed" : inq.status, next_action_on: inq.nextActionOn ?? "", memo: inq.memo ?? "",
  };
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <BackLink href={`/inquiries/${inq.id}`} label="問い合わせの詳細" />
      <PageHeader title="問い合わせを編集" description={`No.${inq.number}　${inq.title}`} />
      <InquiryForm id={inq.id} initial={initial} initialCustomerLabel={inq.customerLabel} options={inquiryFormOptions(user, lookups)} converted={inq.status === "converted"} />
    </div>
  );
}
