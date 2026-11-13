import { notFound } from "next/navigation";
import { BackLink } from "@/components/common/detail";
import { PageHeader } from "@/components/common/page-header";
import { CustomerForm } from "@/components/customers/customer-form";
import { requireUser } from "@/lib/auth";
import { getCustomer } from "@/lib/data/customers";
import { getLookups } from "@/lib/data/lookups";
import type { CustomerInput } from "@/lib/validation";

export const metadata = { title: "顧客を編集" };

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();
  const [data, lookups] = await Promise.all([getCustomer(id, "1900-01-01"), getLookups()]);
  if (!data) notFound();
  const c = data.customer;
  const initial: CustomerInput = {
    type: c.type, company_name: c.companyName ?? "", name: c.name ?? "", department: c.department ?? "", position: c.position ?? "", phone: c.phone ?? "",
    email: c.email ?? "", address: c.address ?? "", owner_id: c.ownerId ?? "", rank: c.rank ?? "", memo: c.memo ?? "", tag_ids: c.tagIds,
  };
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <BackLink href={`/customers/${c.id}`} label="顧客の詳細" />
      <PageHeader title="顧客を編集" description={c.companyName ?? c.name ?? undefined} />
      <CustomerForm id={c.id} initial={initial} options={{ members: lookups.members, tags: lookups.tags }} />
    </div>
  );
}
