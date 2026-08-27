import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const LABELS: Record<string, string> = {
  VACANT: "شاغرة",
  OCCUPIED: "مؤجرة",
  MAINTENANCE: "تحت الصيانة",
  ACTIVE: "ساري",
  EXPIRING_SOON: "قارب على الانتهاء",
  EXPIRED: "منتهي",
  TERMINATED: "مفسوخ",
  PENDING: "مستحق",
  PAID: "مدفوع",
  OVERDUE: "متأخر",
  PARTIAL: "مدفوع جزئياً",
  DRAFT: "مسودة",
  ISSUED: "معتمد",
};

const TONES: Record<string, string> = {
  VACANT: "bg-slate-100 text-slate-700",
  OCCUPIED: "bg-emerald-100 text-emerald-700",
  MAINTENANCE: "bg-amber-100 text-amber-700",
  ACTIVE: "bg-emerald-100 text-emerald-700",
  EXPIRING_SOON: "bg-amber-100 text-amber-700",
  EXPIRED: "bg-slate-100 text-slate-700",
  TERMINATED: "bg-red-100 text-red-700",
  PENDING: "bg-slate-100 text-slate-700",
  PAID: "bg-emerald-100 text-emerald-700",
  OVERDUE: "bg-red-100 text-red-700",
  PARTIAL: "bg-amber-100 text-amber-700",
  DRAFT: "bg-slate-100 text-slate-700",
  ISSUED: "bg-emerald-100 text-emerald-700",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="secondary" className={cn("border-0 font-medium", TONES[status])}>
      {LABELS[status] ?? status}
    </Badge>
  );
}
