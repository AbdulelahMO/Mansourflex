import { timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Generic inbound webhook receiver for external integrations (payment gateways, SMS
 * delivery reports, etc). The integration id in the URL selects which IntegrationConfig
 * secret authenticates the call; every call is logged to IntegrationLog for auditing.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/integrations/webhook/[id]">) {
  const { id } = await ctx.params;

  const integration = await prisma.integrationConfig.findUnique({ where: { id } });
  if (!integration || !integration.isActive) {
    return NextResponse.json({ error: "integration not found or inactive" }, { status: 404 });
  }

  const providedSecret = request.headers.get("x-webhook-secret") ?? "";
  if (integration.apiSecret && !safeEqual(providedSecret, integration.apiSecret)) {
    await prisma.integrationLog.create({
      data: { integrationId: id, direction: "INBOUND", event: "auth_failed", success: false, responseCode: 401 },
    });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const event = typeof body.event === "string" ? body.event : "unknown";
  let handled = false;

  if (event === "payment.paid" && typeof body.paymentId === "string") {
    const payment = await prisma.payment.findUnique({ where: { id: body.paymentId } });
    if (payment) {
      const paidAmount = typeof body.amount === "number" ? body.amount : payment.amount;
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: paidAmount >= payment.amount ? "PAID" : "PARTIAL",
          paidAmount,
          paidDate: body.paidDate ? new Date(body.paidDate) : new Date(),
          method: typeof body.method === "string" ? body.method : integration.name,
          reference: typeof body.reference === "string" ? body.reference : null,
        },
      });
      handled = true;
    }
  }

  await prisma.integrationLog.create({
    data: {
      integrationId: id,
      direction: "INBOUND",
      event,
      payload: JSON.stringify(body).slice(0, 5000),
      responseCode: 200,
      success: true,
    },
  });

  return NextResponse.json({ ok: true, handled });
}
