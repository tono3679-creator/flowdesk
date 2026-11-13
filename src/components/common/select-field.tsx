"use client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NONE = "__none";

export type Option = { value: string; label: string; disabled?: boolean };

/** 選択欄（空の値も選べる。value が "" のとき noneLabel を表示） */
export function SelectField({
  id, value, onChange, options, noneLabel, placeholder, invalid, disabled, className, ariaLabel,
}: {
  id?: string; value: string; onChange: (v: string) => void; options: Option[]; noneLabel?: string; placeholder?: string;
  invalid?: boolean; disabled?: boolean; className?: string; ariaLabel?: string;
}) {
  return (
    <Select value={value === "" ? (noneLabel ? NONE : "") : value} onValueChange={(v) => onChange(v === NONE ? "" : v)} disabled={disabled}>
      <SelectTrigger id={id} aria-invalid={invalid} className={className ?? "w-full"} aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder ?? "選択してください"} />
      </SelectTrigger>
      <SelectContent>
        {noneLabel && <SelectItem value={NONE}>{noneLabel}</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} disabled={o.disabled}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
