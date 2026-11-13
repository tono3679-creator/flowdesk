"use client";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/common/confirm-button";
import { deleteTask } from "@/lib/actions/tasks";
import { safeAction } from "@/lib/client/safe-action";

export function TaskDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  return (
    <ConfirmButton label="削除" icon={<Trash2 aria-hidden />} title="このタスクを削除しますか？" description="元に戻せません。" destructive confirmLabel="削除する"
      onConfirm={async () => {
        const r = await safeAction(() => deleteTask(id));
        if (!r.ok) { toast.error(r.error); return false; }
        toast.success("タスクを削除しました");
        router.push("/tasks");
        return true;
      }} />
  );
}
