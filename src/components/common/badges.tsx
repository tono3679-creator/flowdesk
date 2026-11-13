import {
  AlertOctagon, ArrowDown, ArrowUp, Ban, CheckCircle2, CircleDashed, CircleDot, CirclePause, Clock3, Flame, Hourglass, Minus, Trophy, XCircle,
  Mail, Phone, MessageCircle, Video, MapPin, Handshake, FileText, MoreHorizontal, type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  ACTIVITY_TYPE_LABEL, DEFAULT_PRIORITY_LABEL, INQUIRY_STATUS_LABEL, TASK_STATUS_LABEL,
  type ActivityType, type InquiryStatus, type Priority, type PriorityLabels, type StageCategory, type TagColor, type TaskStatus,
} from "@/lib/domain/labels";
import type { Severity } from "@/lib/domain/alerts";
import { cn } from "@/lib/utils";

type Variant = "neutral" | "info" | "success" | "warning" | "danger" | "outline" | "default";

// 状態は色・アイコン・文字の3つで区別する（色だけに頼らない）

const PRIORITY_STYLE: Record<Priority, { variant: Variant; Icon: LucideIcon }> = {
  low: { variant: "neutral", Icon: ArrowDown },
  medium: { variant: "info", Icon: Minus },
  high: { variant: "warning", Icon: ArrowUp },
  urgent: { variant: "danger", Icon: Flame },
};
export function PriorityBadge({ priority, labels }: { priority: Priority; labels?: PriorityLabels }) {
  const { variant, Icon } = PRIORITY_STYLE[priority];
  return (
    <Badge variant={variant}>
      <Icon aria-hidden />
      {(labels ?? DEFAULT_PRIORITY_LABEL)[priority]}
    </Badge>
  );
}

const INQUIRY_STYLE: Record<InquiryStatus, { variant: Variant; Icon: LucideIcon }> = {
  new: { variant: "danger", Icon: AlertOctagon },
  in_progress: { variant: "info", Icon: CircleDot },
  on_hold: { variant: "warning", Icon: CirclePause },
  converted: { variant: "success", Icon: Trophy },
  closed: { variant: "neutral", Icon: CheckCircle2 },
  not_needed: { variant: "outline", Icon: Ban },
};
export function InquiryStatusBadge({ status }: { status: InquiryStatus }) {
  const { variant, Icon } = INQUIRY_STYLE[status];
  return (
    <Badge variant={variant}>
      <Icon aria-hidden />
      {status === "converted" ? "案件化済み" : INQUIRY_STATUS_LABEL[status]}
    </Badge>
  );
}

const STAGE_STYLE: Record<StageCategory, { variant: Variant; Icon: LucideIcon }> = {
  open: { variant: "info", Icon: CircleDot },
  won: { variant: "success", Icon: Trophy },
  completed: { variant: "success", Icon: CheckCircle2 },
  lost: { variant: "danger", Icon: XCircle },
  hold: { variant: "warning", Icon: CirclePause },
};
export function StageBadge({ name, category }: { name: string; category: StageCategory }) {
  const { variant, Icon } = STAGE_STYLE[category];
  return (
    <Badge variant={variant}>
      <Icon aria-hidden />
      {name}
    </Badge>
  );
}

const TASK_STYLE: Record<TaskStatus, { variant: Variant; Icon: LucideIcon }> = {
  todo: { variant: "neutral", Icon: CircleDashed },
  doing: { variant: "info", Icon: CircleDot },
  waiting: { variant: "warning", Icon: Hourglass },
  done: { variant: "success", Icon: CheckCircle2 },
};
export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const { variant, Icon } = TASK_STYLE[status];
  return (
    <Badge variant={variant}>
      <Icon aria-hidden />
      {TASK_STATUS_LABEL[status]}
    </Badge>
  );
}

const SEVERITY_STYLE: Record<Severity, { variant: Variant; label: string; Icon: LucideIcon }> = {
  critical: { variant: "danger", label: "至急", Icon: Flame },
  high: { variant: "warning", label: "要対応", Icon: AlertOctagon },
  medium: { variant: "info", label: "確認", Icon: Clock3 },
};
export function SeverityBadge({ severity }: { severity: Severity }) {
  const { variant, label, Icon } = SEVERITY_STYLE[severity];
  return (
    <Badge variant={variant}>
      <Icon aria-hidden />
      {label}
    </Badge>
  );
}

const TAG_CLASS: Record<TagColor, string> = {
  slate: "bg-slate-100 text-slate-700 border-slate-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-800 border-amber-200",
  red: "bg-red-50 text-red-700 border-red-200",
  violet: "bg-violet-50 text-violet-700 border-violet-200",
  teal: "bg-teal-50 text-teal-700 border-teal-200",
  pink: "bg-pink-50 text-pink-700 border-pink-200",
};
export function TagChip({ name, color, className }: { name: string; color: TagColor; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap", TAG_CLASS[color], className)}>#{name}</span>;
}

export const ACTIVITY_ICON: Record<ActivityType, LucideIcon> = {
  call: Phone, email: Mail, line: MessageCircle, online_meeting: Video, visit: MapPin, meeting: Handshake, quote: FileText, other: MoreHorizontal,
};
export function ActivityTypeBadge({ type }: { type: ActivityType }) {
  const Icon = ACTIVITY_ICON[type];
  return (
    <Badge variant="outline">
      <Icon aria-hidden />
      {ACTIVITY_TYPE_LABEL[type]}
    </Badge>
  );
}

/** 顧客ランク（S・A・B・C） */
export function RankMark({ rank }: { rank: string }) {
  const tone = rank === "S" ? "bg-primary text-primary-foreground" : rank === "A" ? "bg-brand/15 text-brand" : "bg-muted text-muted-foreground";
  return <span className={cn("inline-flex size-6 items-center justify-center rounded-md text-xs font-bold", tone)} aria-label={`ランク${rank}`}>{rank}</span>;
}
