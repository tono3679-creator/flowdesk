import { BackLink } from "@/components/common/detail";
import { PageHeader } from "@/components/common/page-header";
import { CustomerForm } from "@/components/customers/customer-form";
import { requireUser } from "@/lib/auth";
import { getLookups } from "@/lib/data/lookups";
import type { CustomerInput } from "@/lib/validation";

export const metadata = { title: "顧客を登録" };

export default async function NewCustomerPage() {
  const user = await requireUser();
  const lookups = await getLookups();
  const initial: CustomerInput = {
    type: "corporate", company_name: "", name: "", department: "", position: "", phone: "", email: "", address: "",
    owner_id: user.userId, rank: "", memo: "", tag_ids: [],
  };
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <BackLink href="/customers" label="顧客一覧" />
      <PageHeader title="顧客を登録" />
      <CustomerForm id={null} initial={initial} options={{ members: lookups.members, tags: lookups.tags }} />
    </div>
  );
}
