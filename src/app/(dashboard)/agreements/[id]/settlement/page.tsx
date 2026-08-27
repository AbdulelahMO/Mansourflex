import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { Card, CardContent } from "@/components/ui/card";
import { PrintButton } from "@/components/contracts/print-button";
import { formatCurrency, formatDate } from "@/lib/format";
import { formatHijri } from "@/lib/hijri";
import { cn } from "@/lib/utils";

/** One line of the account; `sign` prefixes the deducted rows so the arithmetic reads on paper. */
function Line({ label, value, deduct, total }: { label: string; value: number; deduct?: boolean; total?: boolean }) {
  return (
    <tr className={cn(total && "bg-muted/60 font-bold")}>
      <td className="border p-2">
        {deduct ? "يُخصم: " : ""}
        {label}
      </td>
      <td className="border p-2 text-left tabular-nums">{formatCurrency(value)}</td>
    </tr>
  );
}

export default async function SettlementStatementPage(props: PageProps<"/agreements/[id]/settlement">) {
  const { id } = await props.params;
  await requirePagePermission("agreements.view");

  const [agreement, org] = await Promise.all([
    prisma.managementAgreement.findUnique({
      where: { id },
      include: {
        owner: true,
        settlement: true,
        buildings: { include: { building: true } },
      },
    }),
    prisma.organizationSettings.findUnique({ where: { id: "default" } }),
  ]);
  if (!agreement) notFound();

  const s = agreement.settlement;
  const owner = agreement.owner;
  const building = agreement.buildings[0]?.building;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href={`/agreements/${agreement.id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="size-4" />
          العودة للاتفاقية
        </Link>
        {s && <PrintButton />}
      </div>

      {!s ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            لم تُصفَّ هذه الاتفاقية بعد. استخدم خيار «تصفية وإنهاء» في صفحة الاتفاقية لإصدار الكشف النهائي.
          </CardContent>
        </Card>
      ) : (
        <Card className="print:border-0 print:shadow-none print:ring-0">
          <CardContent className="space-y-6 p-8 print:p-0">
            <header className="space-y-2 border-b pb-4 text-center">
              {org?.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/files/${org.logoUrl}`} alt="" className="mx-auto h-12 object-contain" />
              )}
              <h1 className="text-lg font-bold">كشف تصفية اتفاقية إدارة أملاك</h1>
              <p className="text-sm text-muted-foreground" dir="ltr">
                {agreement.agreementNumber}
              </p>
            </header>

            <p className="text-sm leading-7">
              بناءً على إنهاء اتفاقية إدارة الأملاك المشار إليها أعلاه بتاريخ {formatDate(s.settledAt)} الموافق{" "}
              {formatHijri(new Date(s.settledAt))}، جرت تصفية الحساب بين الطرفين عن الفترة من{" "}
              {formatDate(s.periodFrom)} إلى {formatDate(s.periodTo)} على النحو التالي:
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1 rounded-lg border p-4 text-sm">
                <p className="font-bold">مدير الأملاك (الطرف الأول)</p>
                <p>{org?.name ?? "—"}</p>
                {org?.commercialRegister && (
                  <p className="text-muted-foreground">السجل التجاري: {org.commercialRegister}</p>
                )}
              </div>
              <div className="space-y-1 rounded-lg border p-4 text-sm">
                <p className="font-bold">المالك (الطرف الثاني)</p>
                <p>{owner.name}</p>
                {building && <p className="text-muted-foreground">العقار: {building.name}</p>}
              </div>
            </div>

            <section className="space-y-2">
              <h2 className="text-sm font-bold">أولاً: حساب المالك</h2>
              <table className="w-full border-collapse text-sm">
                <tbody>
                  <Line label="إجمالي المبالغ المحصّلة خلال الفترة" value={s.collected} />
                  <Line label="المصروفات التي يتحمّلها المالك" value={s.ownerExpenses} deduct />
                  <Line label="صافي المحصّل بعد المصروفات" value={s.netCollected} total />
                  <Line label={`عمولة الإدارة (${s.commissionPercent}% من صافي المحصّل)`} value={s.commission} deduct />
                  <Line label="المستحق توريده للمالك" value={s.payableToOwner} total />
                </tbody>
              </table>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-bold">ثانياً: حساب مدير الأملاك</h2>
              <table className="w-full border-collapse text-sm">
                <tbody>
                  <Line label="عمولة الإدارة المستحقة" value={s.commission} />
                  <Line label="مصروفات تحمّلها مدير الأملاك" value={s.operatorExpenses} deduct />
                  <Line label="صافي العمولة" value={s.netCommission} total />
                </tbody>
              </table>
            </section>

            {(s.pendingArrears > 0 || s.pendingExpenses > 0) && (
              <section className="space-y-2">
                <h2 className="text-sm font-bold">ثالثاً: بنود معلّقة</h2>
                <p className="text-sm leading-7">
                  البنود التالية قائمة حتى تاريخ التصفية ولم تدخل في الحساب أعلاه، ويُسوّى كل بند منها عند تحصيله أو
                  سداده:
                </p>
                <table className="w-full border-collapse text-sm">
                  <tbody>
                    {s.pendingArrears > 0 && <Line label="متأخرات إيجارية لم تُحصّل" value={s.pendingArrears} />}
                    {s.pendingExpenses > 0 && <Line label="مصروفات مسجّلة لم تُدفع" value={s.pendingExpenses} />}
                  </tbody>
                </table>
              </section>
            )}

            {s.notes && (
              <section className="space-y-1">
                <h2 className="text-sm font-bold">ملاحظات</h2>
                <p className="text-sm leading-7 whitespace-pre-wrap">{s.notes}</p>
              </section>
            )}

            <p className="text-sm leading-7">
              وبتوقيع الطرفين على هذا الكشف تُعدّ الاتفاقية منتهية، ويُقرّ كل طرف باستلام مستحقاته المبيّنة أعلاه وبراءة
              ذمة الطرف الآخر فيما عدا البنود المعلّقة إن وُجدت.
            </p>

            <div className="grid gap-8 pt-6 sm:grid-cols-2">
              <div className="space-y-8 text-center">
                <p className="text-sm font-bold">الطرف الأول</p>
                <p className="text-sm">{org?.signatoryName ?? org?.name ?? "—"}</p>
                <p className="border-t pt-2 text-xs text-muted-foreground">التوقيع</p>
              </div>
              <div className="space-y-8 text-center">
                <p className="text-sm font-bold">الطرف الثاني</p>
                <p className="text-sm">{owner.representativeName ?? owner.name}</p>
                <p className="border-t pt-2 text-xs text-muted-foreground">التوقيع</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
