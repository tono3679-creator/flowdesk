"use client";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/common/confirm-button";
import { deleteCustomer } from "@/lib/actions/customers";
import { safeAction } from "@/lib/client/safe-action";

export function CustomerDeleteButton({ id, hasDeals }: { id: string; hasDeals: boolean }) {
  const router = useRouter();
  return (
    <ConfirmButton
      label="削除" icon={<Trash2 aria-hidden />} title="この顧客を削除しますか？" destructive confirmLabel="削除する" disabled={hasDeals}
      description={hasDeals ? "案件がある顧客は削除できません。" : "問い合わせとの紐づけは外れ、顧客だけの対応履歴は削除されます。元に戻せません。"}
      onConfirm={async () => {
        const r = await safeAction(() => deleteCustomer(id));
        if (!r.ok) { toast.error(r.error); return false; }
        toast.success("顧客を削除しました");
        router.push("/customers");
        return true;
      }}
    />
  );
}
