import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Pencil, ReceiptText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser, buildingScope } from "@/lib/session";
import { can } from "@/lib/authz";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { CreateUnitDialog, EditUnitDialog } from "@/components/units/unit-dialogs";
import { BulkUnitsDialog } from "@/components/units/bulk-units-dialog";
import { DeleteButton } from "@/components/delete-button";
import { deleteUnit } from "@/lib/actions/units";
import { deleteBuilding } from "@/lib/actions/buildings";
import { commissionForBuilding, commissionAmount, commissionBase, vatWithin } from "@/lib/commission";
import { ownerExpensesForBuilding, operatorExpensesForBuilding } from "@/lib/expenses";
import { cn } from "@/lib/utils";
import { BuildingLocationMap } from "@/components/buildings/building-location-map";
import { BuildingGallery } from "@/components/buildings/building-gallery";
import { CreateExpenseDialog } from "@/components/expenses/expense-dialogs";
import { ArchiveBuildingButton } from "@/components/buildings/archive-button";

function InfoItem({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

/** One figure at a glance, with the one line of context that keeps it from being misread. */
function Tile({
  label,
  value,
  tone,
  children,
}: {
  label: string;
  value: string;
  tone?: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-lg font-bold tabular-nums", tone)}>{value}</p>
      {children && <p className="text-xs text-muted-foreground">{children}</p>}
    </div>
  );
}

/** One line of the property's account: what it is on the right, what it comes to on the left. */
function Row({
  label,
  value,
  muted,
  strong,
  divider,
  negative,
}: {
  label: string;
  value: number;
  muted?: boolean;
  strong?: boolean;
  divider?: boolean;
  /** A balance that has turned against its owner is stated in red, not by a minus sign alone. */
  negative?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4",
        divider && "border-t pt-1.5",
        muted && "text-muted-foreground"
      )}
    >
      <dt className={cn(strong && "font-medium")}>{label}</dt>
      <dd className={cn("tabular-nums", strong && "font-bold text-primary", negative && "text-red-600")}>
        {formatCurrency(Math.abs(value))}
      </dd>
    </div>
  );
}

export default async function BuildingDetailPage(props: PageProps<"/buildings/[id]">) {
  const { id } = await props.params;
  const user = await requireUser();
  const scope = buildingScope(user);
  // Employees see the action controls their role opens; the server guard enforces the rest.
  const canManage = await can("buildings.edit");

  const building = await prisma.building.findFirst({
    where: { id, ...scope },
    include: {
      owner: true,
      units: { orderBy: { unitNumber: "asc" } },
      contacts: true,
      meters: true,
      photos: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!building) notFound();

  // Read row by row, not summed: the tax rate is on each payment's contract, and a total that
  // has swallowed the tax cannot give it back.
  const collections = await prisma.payment.findMany({
    where: { contract: { unit: { buildingId: building.id } }, paidAmount: { gt: 0 } },
    select: { paidAmount: true, recipient: true, contract: { select: { vatRate: true } } },
  });
  const collected = collections.reduce((sum, p) => sum + (p.paidAmount ?? 0), 0);
  const vat = vatWithin(collections);
  // Rent the owner took straight from the tenant: already in their hands, so it comes off what
  // is still owed to them — while the commission on it stays due.
  const collectedByOwner = collections
    .filter((p) => p.recipient === "OWNER")
    .reduce((sum, p) => sum + (p.paidAmount ?? 0), 0);
  const [expenses, operatorExpenses] = await Promise.all([
    ownerExpensesForBuilding(building.id),
    operatorExpensesForBuilding(building.id),
  ]);
  const amounts = { collected, expenses, vat };

  // The commission comes from the building's active management agreement — the signed terms.
  const terms = await commissionForBuilding(building.id);
  const commissionBasis = commissionBase(amounts);
  const managementFeeAmount = terms ? commissionAmount(terms, amounts) : 0;

  // A cancelled transfer never reached the owner, so it settles nothing.
  const overdue = await prisma.payment.findMany({
    where: {
      contract: { unit: { buildingId: building.id } },
      dueDate: { lte: new Date() },
      status: { not: "PAID" },
    },
    select: { amount: true, paidAmount: true },
  });
  const arrears = overdue.reduce((sum, p) => sum + Math.max(0, p.amount - (p.paidAmount ?? 0)), 0);
  const occupiedUnits = building.units.filter((u) => u.status === "OCCUPIED").length;

  const remittedAgg = await prisma.ownerRemittance.aggregate({
    where: { buildingId: building.id, cancelledAt: null },
    _sum: { amount: true },
  });
  const remitted = remittedAgg._sum.amount ?? 0;
  // What the property owes its owner: everything collected, less what they bear and what the
  // office earns. The tax stays on this side — the owner is the one who remits it to the state.
  // The money splits in two and the halves must add back to it: the operator's commission and
  // the owner's share. The tax rides along inside the owner's share — it is theirs to hand over.
  const divisible = collected - expenses;
  const ownerShare = divisible - managementFeeAmount;
  // Everything that has actually reached the owner, however it reached him.
  const ownerReceived = collectedByOwner + remitted;
  const ownerBalance = ownerShare - ownerReceived;
  // What the operator paid for itself comes off its own commission, not the owner's income.
  const netManagementFee = managementFeeAmount - operatorExpenses;

  return (
    <div className="space-y-4">
      <Link href="/buildings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronRight className="size-4" />
        العودة للمباني
      </Link>

      {building.archivedAt && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          هذا المبنى <span className="font-semibold">مؤرشف</span> منذ {formatDate(building.archivedAt)} — لا يظهر في
          القوائم العاملة ولا يُختار عند إنشاء عقد، وسجلاته محفوظة كاملة.
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{building.name}</h1>
          <p className="text-sm text-muted-foreground">
            {building.city ?? "—"} {building.district ? `- ${building.district}` : ""} · المالك: {building.owner.name}
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <CreateExpenseDialog
              buildings={[{ id: building.id, name: building.name }]}
              units={building.units.map((u) => ({ id: u.id, unitNumber: u.unitNumber, buildingId: building.id }))}
              defaultBuildingId={building.id}
              trigger={
                <Button variant="outline">
                  <ReceiptText className="size-4" />
                  تسجيل مصروف
                </Button>
              }
            />
            <ArchiveBuildingButton buildingId={building.id} archived={!!building.archivedAt} />
            <Button variant="outline" asChild>
              <Link href={`/buildings/${building.id}/edit`}>
                <Pencil className="size-4" />
                تعديل
              </Link>
            </Button>
            <DeleteButton
              action={deleteBuilding.bind(null, building.id)}
              permission="buildings.delete" title="حذف المبنى"
              description="يُحذف المبنى وكل ما يتبعه: وحداته وعقوده ودفعاته ومستنداته ومصروفاته وصوره. للاحتفاظ بالسجلات استخدم «الأرشفة» بدلاً من الحذف."
            />
          </div>
        )}
      </div>

      {/* Five figures side by side looked equal and were not: they are one calculation, and laid
          out as a row nobody could see that 212,255 × 7% is not the commission shown — the tax and
          the expenses had come out in between. Read downward, each line explains the next, and the
          reader can check the arithmetic instead of trusting it. */}
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between border-b py-3.5">
          <CardTitle className="text-base">نظرة على العقار</CardTitle>
          <div className="flex items-center gap-3">
            <Link href={`/owners/${building.ownerId}/statement?building=${building.id}`} className="text-xs text-primary hover:underline">
              كشف حساب المالك
            </Link>
            {terms ? (
              <Link href={`/agreements/${terms.agreementId}`} className="text-xs text-primary hover:underline" dir="ltr">
                {terms.agreementNumber}
              </Link>
            ) : (
              <Link href="/agreements/new" className="text-xs text-primary hover:underline">
                إنشاء اتفاقية
              </Link>
            )}
          </div>
        </CardHeader>

        <CardContent className="grid grid-cols-2 gap-4 py-4 sm:grid-cols-3 lg:grid-cols-5">
          {/* A glance, not a ledger: someone opening a property wants to know at once how full it
              is, what it has produced, what is late, and where each side stands. The working — the
              splits and deductions behind these figures — belongs in the owner's statement, and
              this card links to it rather than repeating it. */}
          <Tile label="الإشغال" value={`${occupiedUnits} من ${building.units.length}`}>
            {building.units.length > 0 && `${Math.round((occupiedUnits / building.units.length) * 100)}% مؤجّرة`}
          </Tile>

          <Tile label="المحصّل منذ البداية" value={formatCurrency(collected)}>
            {vat > 0 && `منها ضريبة ${formatCurrency(vat)}`}
          </Tile>

          <Tile
            label="المتأخر"
            value={formatCurrency(arrears)}
            tone={arrears > 0 ? "text-red-600" : undefined}
          >
            حلّ موعده ولم يُحصَّل
          </Tile>

          {/* The headline is the figure that asks for an action — what is still owed to the owner —
              and beneath it the two numbers it came from. Leading with his share instead was read
              as money already transferred to him. */}
          <Tile
            label={ownerBalance < 0 ? "قُبض للمالك زيادة" : "باقٍ للمالك"}
            value={formatCurrency(Math.abs(ownerBalance))}
            tone={ownerBalance < 0 ? "text-red-600" : "text-emerald-700"}
          >
            نصيبه {formatCurrency(ownerShare)} · وصله {formatCurrency(ownerReceived)}
          </Tile>

          <Tile
            label={terms ? (operatorExpenses > 0 ? "صافي دخل المشغل" : `عمولة الإدارة (${terms.percent}%)`) : "عمولة الإدارة"}
            value={terms ? formatCurrency(operatorExpenses > 0 ? netManagementFee : managementFeeAmount) : "—"}
            tone={netManagementFee < 0 ? "text-red-600" : undefined}
          >
            {terms
              ? operatorExpenses > 0
                ? `عمولة ${formatCurrency(managementFeeAmount)} · مصروفاته ${formatCurrency(operatorExpenses)}`
                : "بلا مصروفات على المشغل"
              : "لا اتفاقية إدارة سارية"}
          </Tile>
        </CardContent>
      </Card>

      {building.photos.length > 0 && (
        <Card className="gap-0 py-0">
          <CardHeader className="border-b py-3.5">
            <CardTitle className="text-base">صور العقار ({building.photos.length})</CardTitle>
          </CardHeader>
          <CardContent className="py-4">
            <BuildingGallery photos={building.photos} canManage={canManage} />
          </CardContent>
        </Card>
      )}

      {building.latitude && building.longitude && (
        <Card className="gap-0 py-0">
          <CardHeader className="border-b py-3.5">
            <CardTitle className="text-base">موقع العقار</CardTitle>
          </CardHeader>
          <CardContent className="py-4">
            <BuildingLocationMap lat={building.latitude} lng={building.longitude} name={building.name} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 py-4 sm:grid-cols-4">
          <InfoItem label="القطاع" value={building.sector} />
          <InfoItem label="نوع الاستخدام" value={building.usageType} />
          <InfoItem label="نوع العقار" value={building.propertyType} />
          <InfoItem label="رقم العقار" value={building.propertyNumber} />
          <InfoItem label="المساحة" value={building.areaSqm ? `${building.areaSqm} م²` : null} />
          <InfoItem label="عدد الطوابق" value={building.floorsCount} />
          <InfoItem label="عدد الوحدات بكل طابق" value={building.unitsPerFloor} />
          <InfoItem label="تاريخ البناء" value={formatDate(building.constructionDate)} />
          <InfoItem label="نوع الصك" value={building.deedType} />
          <InfoItem label="رقم الصك" value={building.deedNumber} />
          <InfoItem label="تاريخ إصدار الصك" value={formatDate(building.deedIssueDate)} />
          <InfoItem label="العنوان التفصيلي" value={building.address} />
          {building.deedFileUrl && (
            <div>
              <p className="text-xs text-muted-foreground">ملف الصك</p>
              <a href={`/api/files/${building.deedFileUrl}`} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary hover:underline">
                عرض الملف
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {(building.description || building.shopsCount || building.apartmentsCount || building.elevatorsCount) && (
        <Card>
          <CardHeader className="py-3.5">
            <CardTitle className="text-base">وصف العقار ومحتوياته</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {building.description && <p className="text-sm text-muted-foreground">{building.description}</p>}
            <div className="grid grid-cols-3 gap-4">
              <InfoItem label="عدد المحلات" value={building.shopsCount} />
              <InfoItem label="عدد الشقق" value={building.apartmentsCount} />
              <InfoItem label="عدد المصاعد" value={building.elevatorsCount} />
            </div>
          </CardContent>
        </Card>
      )}

      {(building.meters.length > 0 || building.streetName || building.buildingNumber || building.postalCode) && (
        <Card>
          <CardHeader className="py-3.5">
            <CardTitle className="text-base">العدادات والعنوان الوطني</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {building.meters.length > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {building.meters.map((m) => (
                  <div key={m.id} className="rounded-lg border p-3 text-sm">
                    <p className="font-medium">{m.type === "ELECTRICITY" ? "عداد كهرباء" : "عداد مياه"}</p>
                    <p className="text-xs text-muted-foreground" dir="ltr">
                      {m.meterNumber ? `رقم العداد: ${m.meterNumber}` : ""} {m.subscriptionNumber ? `· اشتراك: ${m.subscriptionNumber}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <InfoItem label="اسم الشارع" value={building.streetName} />
              <InfoItem label="رقم المبنى" value={building.buildingNumber} />
              <InfoItem label="الرمز البريدي" value={building.postalCode} />
              <InfoItem label="الرقم الإضافي" value={building.additionalNumber} />
            </div>
          </CardContent>
        </Card>
      )}

      {building.contacts.length > 0 && (
        <Card>
          <CardHeader className="py-3.5">
            <CardTitle className="text-base">جهات الاتصال</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {building.contacts.map((c) => (
              <div key={c.id} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.role ?? "—"} {c.phone ? `· ${c.phone}` : ""}
                </p>
                {c.note && <p className="mt-1 text-xs text-muted-foreground">{c.note}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="gap-0 py-0">
        <CardHeader className="flex-row items-center justify-between space-y-0 border-b py-3.5">
          <CardTitle className="text-base">الوحدات ({building.units.length})</CardTitle>
          {canManage && (
            <div className="flex items-center gap-2">
              <BulkUnitsDialog buildingId={building.id} />
              <CreateUnitDialog buildingId={building.id} />
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {building.units.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">لا توجد وحدات مضافة بعد</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الوحدة</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>المساحة</TableHead>
                    <TableHead>الإيجار</TableHead>
                    <TableHead>الحالة</TableHead>
                    {canManage && <TableHead className="w-24">خيارات</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {building.units.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        {u.unitNumber} {u.floor ? `(ط ${u.floor})` : ""}
                      </TableCell>
                      <TableCell>{u.unitType ?? "—"}</TableCell>
                      <TableCell>{u.areaSqm ? `${u.areaSqm} م²` : "—"}</TableCell>
                      <TableCell>{formatCurrency(u.rentAmount)}</TableCell>
                      <TableCell>
                        <StatusBadge status={u.status} />
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <EditUnitDialog unit={u} />
                            <DeleteButton action={deleteUnit.bind(null, u.id)} permission="units.delete" title="حذف الوحدة" description="سيتم حذف الوحدة نهائياً." />
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
