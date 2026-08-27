import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/authz";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  CreateIntegrationDialog,
  EditIntegrationDialog,
  TYPE_LABELS,
} from "@/components/integrations/integration-dialogs";
import { CopyWebhookUrl } from "@/components/integrations/copy-webhook-url";
import { ToggleActive } from "@/components/integrations/toggle-active";
import { DeleteButton } from "@/components/delete-button";
import { deleteIntegration } from "@/lib/actions/integrations";
import { formatDate } from "@/lib/format";
import { Plug } from "lucide-react";

export default async function IntegrationsPage() {
  await requirePagePermission("settings.integrations");

  const integrations = await prisma.integrationConfig.findMany({
    orderBy: { createdAt: "desc" },
  });

  const recentLogs = await prisma.integrationLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { integration: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الربط والتكاملات</h1>
          <p className="text-sm text-muted-foreground">
            اربط النظام مع جهات خارجية مثل بوابات الدفع، مزودي SMS/واتساب، أو أي API آخر
          </p>
        </div>
        <CreateIntegrationDialog />
      </div>

      {integrations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <Plug className="size-10" />
            <p>لا توجد جهات مرتبطة بعد</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="py-0">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الاسم</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>رابط Webhook للاستقبال</TableHead>
                    <TableHead>مفعّل</TableHead>
                    <TableHead className="w-24">خيارات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {integrations.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="border-0">{TYPE_LABELS[i.type]}</Badge>
                      </TableCell>
                      <TableCell>
                        <CopyWebhookUrl path={`/api/integrations/webhook/${i.id}`} />
                      </TableCell>
                      <TableCell>
                        <ToggleActive id={i.id} isActive={i.isActive} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <EditIntegrationDialog integration={i} />
                          <DeleteButton action={deleteIntegration.bind(null, i.id)} title="حذف الربط" description="سيتم حذف بيانات الربط نهائياً." />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="mb-2 text-lg font-semibold">سجل الأحداث الأخيرة</h2>
        <Card className="py-0">
          <CardContent className="p-0">
            {recentLogs.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">لا يوجد سجل أحداث بعد</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الجهة</TableHead>
                      <TableHead>الاتجاه</TableHead>
                      <TableHead>الحدث</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>التاريخ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{log.integration.name}</TableCell>
                        <TableCell>{log.direction === "INBOUND" ? "وارد" : "صادر"}</TableCell>
                        <TableCell dir="ltr" className="text-right">{log.event}</TableCell>
                        <TableCell>
                          {log.success ? (
                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-0">نجاح</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-red-100 text-red-700 border-0">فشل</Badge>
                          )}
                        </TableCell>
                        <TableCell>{formatDate(log.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
