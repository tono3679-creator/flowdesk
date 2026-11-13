"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/common/form-field";
import { SelectField } from "@/components/common/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addMember, updateMember } from "@/lib/actions/settings";
import { safeAction } from "@/lib/client/safe-action";
import { ORG_ROLES, ROLE_LABEL, type OrgRole } from "@/lib/domain/labels";

type Member = { id: string; name: string; title: string | null; role: OrgRole; isActive: boolean };

/** メンバーと役割（管理者・マネージャー・一般担当者） */
export function MemberEditor({ members, currentUserId, isDemo }: { members: Member[]; currentUserId: string; isDemo: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const change = (m: Member, role: OrgRole, isActive: boolean) => startTransition(async () => {
    const r = await safeAction(() => updateMember(m.id, role, isActive));
    if (!r.ok) return void toast.error(r.error);
    toast.success(`${m.name}さんを更新しました`);
    router.refresh();
  });

  return (
    <div className="grid gap-5">
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="px-4 py-2 text-left">氏名</th><th className="px-4 py-2 text-left">役割</th><th className="px-4 py-2 text-left">状態</th></tr></thead>
          <tbody className="divide-y">
            {members.map((m) => (
              <tr key={m.id} className={m.isActive ? "" : "text-muted-foreground"}>
                <td className="px-4 py-2.5"><div className="font-medium">{m.name}{m.id === currentUserId && <span className="ml-1 text-xs text-muted-foreground">（あなた）</span>}</div><div className="text-xs text-muted-foreground">{m.title ?? ""}</div></td>
                <td className="px-4 py-2.5 w-48">
                  <SelectField value={m.role} disabled={pending || isDemo} onChange={(v) => change(m, v as OrgRole, m.isActive)} ariaLabel={`${m.name}さんの役割`}
                    options={ORG_ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))} />
                </td>
                <td className="px-4 py-2.5">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={m.isActive} disabled={pending || isDemo || m.id === currentUserId} onChange={(e) => change(m, m.role, e.target.checked)} />
                    {m.isActive ? "利用中" : "停止中"}
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t px-4 py-2 text-xs text-muted-foreground">
          管理者：すべての操作と設定／マネージャー：チーム全体の閲覧・割り当て・分析・CSV／一般担当者：自分の担当分と未割当の問い合わせ。
          {isDemo && " デモ環境では役割の変更・メンバー追加はできません（画面上部の「役割を切り替え」で各役割を体験できます）。"}
        </div>
      </div>
      {!isDemo && <AddMember />}
    </div>
  );
}

function AddMember() {
  const router = useRouter();
  const blank = { email: "", display_name: "", title: "", role: "member" as OrgRole, password: "" };
  const [v, setV] = useState(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  return (
    <form className="grid gap-4 rounded-xl border bg-card p-4 sm:p-5" noValidate onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      const r = await safeAction(() => addMember(v));
      setBusy(false);
      if (!r.ok) { setErrors(r.fieldErrors ?? {}); return void toast.error(r.error); }
      setErrors({}); setV(blank);
      toast.success("メンバーを追加しました。メールアドレスと初期パスワードを本人に伝えてください");
      router.refresh();
    }}>
      <h3 className="text-sm font-semibold">メンバーを追加</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="氏名" htmlFor="m_name" required error={errors.display_name}><Input id="m_name" value={v.display_name} onChange={(e) => setV({ ...v, display_name: e.target.value })} /></Field>
        <Field label="役職" htmlFor="m_title" error={errors.title}><Input id="m_title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></Field>
        <Field label="メールアドレス" htmlFor="m_email" required error={errors.email}><Input id="m_email" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
        <Field label="役割" htmlFor="m_role" required><SelectField id="m_role" value={v.role} onChange={(x) => setV({ ...v, role: x as OrgRole })} options={ORG_ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))} /></Field>
        <Field label="初期パスワード" htmlFor="m_pw" required error={errors.password} hint="12文字以上"><Input id="m_pw" type="password" autoComplete="new-password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} /></Field>
      </div>
      <div className="flex justify-end"><Button type="submit" disabled={busy}>{busy ? <Loader2 className="animate-spin" aria-hidden /> : <UserPlus />}追加する</Button></div>
    </form>
  );
}
