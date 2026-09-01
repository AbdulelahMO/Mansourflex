import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { Card, CardContent } from "@/components/ui/card";
import { PrintButton } from "@/components/contracts/print-button";
import { formatCurrency, formatDate } from "@/lib/format";
import { formatHijri } from "@/lib/hijri";
import { COMMISSION_BASIS_LABEL, SETTLEMENT_FREQUENCY_SENTENCES } from "@/lib/commission";
import { DEFAULT_AGREEMENT_PREAMBLE, DEFAULT_AGREEMENT_CLOSING } from "@/lib/agreement-text";

/** A labelled line inside a party block; omitted entirely when the value is missing. */
function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <p className="text-sm">
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium">{value}</span>
    </p>
  );
}

function Clause({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-bold">
        البند {number}: {title}
      </h2>
      <div className="text-sm leading-7">{children}</div>
    </section>
  );
}

export default async function AgreementPrintPage(props: PageProps<"/agreements/[id]/print">) {
  const { id } = await props.params;
  await requirePagePermission("agreements.view");

  const [agreement, org] = await Promise.all([
    prisma.managementAgreement.findUnique({
      where: { id },
      include: {
        owner: true,
        buildings: { include: { building: true } },
      },
    }),
    prisma.organizationSettings.findUnique({ where: { id: "default" } }),
  ]);
  if (!agreement) notFound();

  const owner = agreement.owner;
  const isCompany = owner.ownerType === "COMPANY";
  const signedOn = agreement.signedAt ?? agreement.startDate;

  const authorities = [
    agreement.canSignContracts && "توقيع عقود الإيجار مع المستأجرين نيابة عن الطرف الثاني.",
    agreement.canCollectRent && "تحصيل الإيجارات ومستحقات العقارات نيابة عن الطرف الثاني.",
    agreement.canMaintain &&
      (agreement.maintenanceLimit
        ? `تنفيذ أعمال الصيانة اللازمة بما لا يتجاوز ${formatCurrency(agreement.maintenanceLimit)} للعمل الواحد دون الرجوع للطرف الثاني.`
        : "تنفيذ أعمال الصيانة اللازمة للعقارات."),
    agreement.canLitigate && "رفع الدعاوى وطلبات الإخلاء والتنفيذ عبر منصة ناجز نيابة عن الطرف الثاني.",
    agreement.canNegotiateRenewal && "التفاوض على قيمة الإيجار وتجديد العقود.",
  ].filter(Boolean) as string[];

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
        <PrintButton />
      </div>

      <Card className="print:border-0 print:shadow-none print:ring-0">
        <CardContent className="space-y-6 p-8 print:p-0">
          <header className="space-y-2 border-b pb-4 text-center">
            {org?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/files/${org.logoUrl}`} alt="" className="mx-auto h-12 object-contain" />
            )}
            <h1 className="text-lg font-bold">اتفاقية إدارة أملاك</h1>
            <p className="text-sm text-muted-foreground" dir="ltr">
              {agreement.agreementNumber}
            </p>
          </header>

          <p className="text-sm leading-7">
            إنه في يوم {formatDate(signedOn)} الموافق {formatHijri(new Date(signedOn))}
            {agreement.signedPlace ? ` بمدينة ${agreement.signedPlace}` : ""}، تم الاتفاق بين كل من:
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1 rounded-lg border p-4">
              <p className="text-sm font-bold">الطرف الأول (مدير الأملاك)</p>
              <Field label="الاسم" value={org?.name} />
              <Field label="السجل التجاري" value={org?.commercialRegister} />
              <Field label="الرقم الضريبي" value={org?.taxNumber} />
              <Field label="العنوان" value={org?.nationalAddress || org?.address} />
              <Field label="الهاتف" value={org?.phone} />
              <Field
                label="ويمثله"
                value={org?.signatoryName ? `${org.signatoryName}${org.signatoryTitle ? ` — ${org.signatoryTitle}` : ""}` : null}
              />
            </div>

            <div className="space-y-1 rounded-lg border p-4">
              <p className="text-sm font-bold">الطرف الثاني (المالك)</p>
              <Field label="الاسم" value={owner.name} />
              <Field label={isCompany ? "الرقم الموحد" : "رقم الهوية"} value={isCompany ? owner.unifiedNumber : owner.nationalId} />
              <Field label="الرقم الضريبي" value={owner.taxNumber} />
              <Field label="الهاتف" value={owner.phone} />
              <Field label="البريد الإلكتروني" value={owner.email} />
              <Field
                label="ويمثله"
                value={owner.representativeName}
              />
            </div>
          </div>

          <p className="text-sm leading-7 whitespace-pre-wrap">
            <span className="font-bold">تمهيد: </span>
            {org?.agreementPreamble?.trim() || DEFAULT_AGREEMENT_PREAMBLE}
          </p>

          <Clause number="الأول" title="العقار المشمول ونسبة الإدارة">
            <p className="mb-2">تشمل هذه الاتفاقية العقار التالي، ويستحق الطرف الأول عنه النسبة الموضّحة أمامه {COMMISSION_BASIS_LABEL}:</p>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-muted/60">
                  <th className="border p-2 text-right">العقار</th>
                  <th className="border p-2 text-right">المدينة / الحي</th>
                  <th className="border p-2 text-right">رقم الصك</th>
                  <th className="border p-2 text-right">نسبة الإدارة</th>
                </tr>
              </thead>
              <tbody>
                {agreement.buildings.map((line) => (
                  <tr key={line.id}>
                    <td className="border p-2 font-medium">{line.building.name}</td>
                    <td className="border p-2">
                      {line.building.city ?? "—"} {line.building.district ? `- ${line.building.district}` : ""}
                    </td>
                    <td className="border p-2" dir="ltr">
                      {line.building.deedNumber ?? "—"}
                    </td>
                    <td className="border p-2 tabular-nums">{line.commissionPercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2">
              {SETTLEMENT_FREQUENCY_SENTENCES[agreement.settlementFrequency] ??
                SETTLEMENT_FREQUENCY_SENTENCES.PER_COLLECTION}
              ، ويُصدَر بكل تسوية سندٌ يوضّح المخصوم والمورَّد.
            </p>
          </Clause>

          <Clause number="الثاني" title="مدة الاتفاقية">
            <p>
              تبدأ هذه الاتفاقية من تاريخ {formatDate(agreement.startDate)} وتنتهي في {formatDate(agreement.endDate)}،
              وتُجدَّد باتفاق الطرفين كتابةً.
            </p>
          </Clause>

          <Clause number="الثالث" title="صلاحيات الطرف الأول">
            {authorities.length > 0 ? (
              <ol className="list-decimal space-y-1 pe-5">
                {authorities.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ol>
            ) : (
              <p className="text-muted-foreground">لم تُحدَّد صلاحيات في هذه الاتفاقية.</p>
            )}
            {agreement.otherAuthorities && <p className="mt-2 whitespace-pre-wrap">{agreement.otherAuthorities}</p>}
          </Clause>

          {agreement.duties && (
            <Clause number="الرابع" title="واجبات الطرف الأول">
              <p className="whitespace-pre-wrap">{agreement.duties}</p>
            </Clause>
          )}

          {agreement.terms && (
            <Clause number={agreement.duties ? "الخامس" : "الرابع"} title="شروط عامة">
              <p className="whitespace-pre-wrap">{agreement.terms}</p>
            </Clause>
          )}

          <p className="text-sm leading-7 whitespace-pre-wrap">
            {org?.agreementClosing?.trim() || DEFAULT_AGREEMENT_CLOSING}
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
    </div>
  );
}
