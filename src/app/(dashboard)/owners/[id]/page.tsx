import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Building2, FileText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EditOwnerDialog } from "@/components/owners/owner-dialogs";
import { OwnerAccessCard } from "@/components/owners/owner-access-card";
import { DeleteButton } from "@/components/delete-button";
import { deleteOwner } from "@/lib/actions/owners";
import { formatCurrency } from "@/lib/format";
import { commissionByBuilding } from "@/lib/commission";

function InfoItem({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

export default async function OwnerDetailPage(props: PageProps<"/owners/[id]">) {
  const { id } = await props.params;
  const viewer = await requirePagePermission("owners.view");

  const owner = await prisma.owner.findUnique({
    where: { id },
    include: {
      user: true,
      buildings: {
        orderBy: { name: "asc" },
        include: {
          units: {
            include: { contracts: { include: { payments: true } } },
          },
        },
      },
    },
  });
  if (!owner) notFound();

  const isCompany = owner.ownerType === "COMPANY";

  // Commission terms come from each building's active management agreement.
  const terms = await commissionByBuilding(owner.buildings.map((b) => b.id));

  // Instalments not yet due are shown on the contract but never counted as arrears.
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  // Collection figures are rolled up from every payment under this owner's buildings.
  const perBuilding = owner.buildings.map((b) => {
    const payments = b.units.flatMap((u) => u.contracts.flatMap((c) => c.payments));
    const collected = payments.reduce((sum, p) => sum + (p.paidAmount ?? 0), 0);
    const due = payments.filter((p) => p.dueDate <= endOfToday);
    const outstanding = due.reduce((sum, p) => sum + Math.max(0, p.amount - (p.paidAmount ?? 0)), 0);
    const upcoming = payments
      .filter((p) => p.dueDate > endOfToday)
      .reduce((sum, p) => sum + Math.max(0, p.amount - (p.paidAmount ?? 0)), 0);
    const occupied = b.units.filter((u) => u.status === "OCCUPIED").length;
    return {
      id: b.id,
      name: b.name,
      city: b.city,
      district: b.district,
      unitsCount: b.units.length,
      occupied,
      collected,
      outstanding,
      upcoming,
      terms: terms.get(b.id) ?? null,
    };
  });

  const totalUnits = perBuilding.reduce((s, b) => s + b.unitsCount, 0);
  const totalOccupied = perBuilding.reduce((s, b) => s + b.occupied, 0);

  return (
    <div className="space-y-4">
      <Link href="/owners" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronRight className="size-4" />
        العودة للملاك
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{owner.name}</h1>
            <Badge variant="secondary" className="border-0">
              {isCompany ? "شركة / مؤسسة" : owner.ownerType === "INDIVIDUAL" ? "فرد" : "غير محدد"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {owner.user
              ? `${owner.user.isActive ? "حساب دخول مفعّل" : "حساب دخول موقوف"} · ${owner.user.email}`
              : "لا يوجد حساب دخول"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" asChild>
            <Link href={`/owners/${owner.id}/statement`}>
              <FileText className="size-4" />
              كشف حساب
            </Link>
          </Button>
          <EditOwnerDialog owner={owner} />
          <DeleteButton
            action={deleteOwner.bind(null, owner.id)}
            permission="owners.delete" title="حذف المالك"
            description="لا يمكن حذف مالك مرتبط بمباني."
          />
        </div>
      </div>

      {/* Income figures belong to the owner-agreement page, not here. */}
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 py-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">عدد المباني</p>
            <p className="text-sm font-medium tabular-nums">{owner.buildings.length}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">الوحدات (المؤجّرة / الكل)</p>
            <p className="text-sm font-medium tabular-nums">
              {totalOccupied} / {totalUnits}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 py-4 sm:grid-cols-4">
          <InfoItem label="الجوال" value={owner.phone} />
          <InfoItem label="البريد الإلكتروني" value={owner.email} />
          {!isCompany && <InfoItem label="رقم الهوية" value={owner.nationalId} />}
          {isCompany && <InfoItem label="الرقم الموحد" value={owner.unifiedNumber} />}
          <InfoItem label="الرقم الضريبي" value={owner.taxNumber} />
        </CardContent>
      </Card>

      {/* Sign-in accounts are the administrator's to hand out, and optional for the owner. */}
      {viewer.role === "ADMIN" && (
        <OwnerAccessCard
          ownerId={owner.id}
          ownerName={owner.name}
          ownerEmail={owner.email}
          login={
            owner.user
              ? {
                  email: owner.user.email,
                  isActive: owner.user.isActive,
                  mustChangePassword: owner.user.mustChangePassword,
                }
              : null
          }
        />
      )}

      {isCompany && owner.representativeName && (
        <Card className="gap-0 py-0">
          <CardHeader className="border-b py-3.5">
            <CardTitle className="text-base">ممثل الشركة / المؤسسة</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 py-4 sm:grid-cols-4">
            <InfoItem label="الاسم" value={owner.representativeName} />
            <InfoItem label="رقم الهوية" value={owner.representativeNationalId} />
            <InfoItem label="الجوال" value={owner.representativePhone} />
            <InfoItem label="البريد الإلكتروني" value={owner.representativeEmail} />
          </CardContent>
        </Card>
      )}

      {owner.notes && (
        <Card>
          <CardContent className="py-4 text-sm text-muted-foreground">{owner.notes}</CardContent>
        </Card>
      )}

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-3.5">
          <CardTitle className="text-base">المباني ({owner.buildings.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {perBuilding.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center text-muted-foreground">
              <Building2 className="size-8" />
              <p className="text-sm">لا توجد مباني مسجلة لهذا المالك</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المبنى</TableHead>
                    <TableHead>المدينة / الحي</TableHead>
                    <TableHead>الوحدات</TableHead>
                    <TableHead>الإشغال</TableHead>
                    <TableHead>نسبة الإدارة</TableHead>
                    <TableHead className="text-left">المحصّل</TableHead>
                    <TableHead className="text-left">المتأخر</TableHead>
                    <TableHead className="text-left">أقساط قادمة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perBuilding.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">
                        <Link href={`/buildings/${b.id}`} className="hover:underline">
                          {b.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {b.city ?? "—"} {b.district ? `- ${b.district}` : ""}
                      </TableCell>
                      <TableCell className="tabular-nums">{b.unitsCount}</TableCell>
                      <TableCell className="tabular-nums">
                        {b.unitsCount > 0 ? `${b.occupied}/${b.unitsCount}` : "—"}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {b.terms ? (
                          <Link href={`/agreements/${b.terms.agreementId}`} className="hover:underline">
                            {b.terms.percent}%
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-left font-medium text-emerald-600 tabular-nums">
                        {formatCurrency(b.collected)}
                      </TableCell>
                      <TableCell
                        className={
                          "text-left tabular-nums " + (b.outstanding > 0 ? "font-medium text-red-600" : "text-muted-foreground")
                        }
                      >
                        {formatCurrency(b.outstanding)}
                      </TableCell>
                      <TableCell className="text-left tabular-nums text-muted-foreground">
                        {formatCurrency(b.upcoming)}
                      </TableCell>
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
