import { BackLink } from "@/components/common/detail";
import { PageHeader } from "@/components/common/page-header";
import { CustomerImport } from "@/components/customers/customer-import";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "顧客の CSV 取り込み" };

export default async function CustomerImportPage() {
  await requireRole(["admin", "manager"]);
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <BackLink href="/customers" label="顧客一覧" />
      <PageHeader title="顧客の CSV 取り込み" description="ほかのツールや Excel で管理していた顧客を、まとめて登録します。エラーのある行は取り込まずにお知らせします" />
      <CustomerImport />
    </div>
  );
}
