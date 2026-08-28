"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { KeyRound, Copy, Check, UserPlus, Ban, CircleCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createOwnerLogin,
  resetOwnerPassword,
  setOwnerLoginActive,
  removeOwnerLogin,
  type OwnerAccessState,
} from "@/lib/actions/owner-access";

type Login = { email: string; isActive: boolean; mustChangePassword: boolean } | null;

/**
 * Signing in is optional for an owner: the account is made when one is asked for, and the
 * credentials shown here are temporary — the owner replaces the password on first sign-in,
 * so this panel never displays a password that is still in use.
 */
export function OwnerAccessCard({
  ownerId,
  ownerName,
  ownerEmail,
  login,
}: {
  ownerId: string;
  ownerName: string;
  ownerEmail: string | null;
  login: Login;
}) {
  const [pending, startTransition] = useTransition();
  const [issued, setIssued] = useState<{ username?: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState<null | "reset" | "remove">(null);

  function run(work: () => Promise<OwnerAccessState>, done?: string) {
    startTransition(async () => {
      const result = await work();
      setConfirm(null);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.password) {
        setIssued({ username: result.username, password: result.password });
        setCopied(false);
      } else if (done || result.message) {
        toast.success(result.message ?? done);
      }
    });
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">حساب الدخول</CardTitle>
          {login ? (
            <Badge variant={login.isActive ? "default" : "secondary"}>
              {login.isActive ? "مفعّل" : "موقوف"}
            </Badge>
          ) : (
            <Badge variant="outline">غير مفعّل</Badge>
          )}
        </CardHeader>

        <CardContent className="space-y-3">
          {login ? (
            <>
              <div>
                <p className="text-xs text-muted-foreground">اسم المستخدم</p>
                <p className="text-sm font-medium" dir="ltr">
                  {login.email}
                </p>
              </div>
              {login.mustChangePassword && (
                <p className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">
                  كلمة المرور مؤقتة — يغيّرها المالك عند أول دخول قبل أن يرى شيئاً من بوابته.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" disabled={pending} onClick={() => setConfirm("reset")}>
                  <KeyRound className="size-4" />
                  إعادة تعيين كلمة المرور
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => setOwnerLoginActive(ownerId, !login.isActive),
                      login.isActive ? "تم إيقاف الحساب" : "تم تفعيل الحساب"
                    )
                  }
                >
                  {login.isActive ? <Ban className="size-4" /> : <CircleCheck className="size-4" />}
                  {login.isActive ? "إيقاف مؤقت" : "تفعيل"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={pending}
                  onClick={() => setConfirm("remove")}
                >
                  <Trash2 className="size-4" />
                  إلغاء الحساب
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                لا يحتاج كل مالك حساباً. أنشئه عند طلبه، ليدخل بوابته ويرى أملاكه وكشوف حسابه — عرضاً فقط.
              </p>
              {!ownerEmail && (
                <p className="rounded-lg border bg-muted/40 p-2.5 text-xs text-muted-foreground">
                  أضف البريد الإلكتروني للمالك أولاً، فهو اسم المستخدم الذي يدخل به.
                </p>
              )}
              <Button
                size="sm"
                disabled={pending || !ownerEmail}
                onClick={() => run(() => createOwnerLogin(ownerId))}
              >
                <UserPlus className="size-4" />
                إنشاء حساب دخول
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* بيانات الدخول تُعرض مرة واحدة، فلا تُحفظ في النظام بصورة مقروءة */}
      <AlertDialog open={!!issued} onOpenChange={(next) => !next && setIssued(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>بيانات دخول {ownerName}</AlertDialogTitle>
            <AlertDialogDescription>
              سلّمها للمالك الآن — لن تظهر مرة أخرى، وسيُطلب منه تغيير كلمة المرور عند أول دخول.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2 rounded-lg border bg-muted/50 p-3">
            {issued?.username && (
              <div>
                <p className="text-xs text-muted-foreground">اسم المستخدم</p>
                <code className="text-sm font-medium" dir="ltr">
                  {issued.username}
                </code>
              </div>
            )}
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">كلمة المرور المؤقتة</p>
                <code className="text-base font-bold tracking-wider" dir="ltr">
                  {issued?.password}
                </code>
              </div>
              <Button variant="outline" size="sm" onClick={() => issued && copy(issued.password)}>
                {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                {copied ? "نُسخت" : "نسخ"}
              </Button>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogAction>تم</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirm} onOpenChange={(next) => !next && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "remove" ? "إلغاء حساب الدخول؟" : "إعادة تعيين كلمة المرور؟"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "remove"
                ? "يُحذف الحساب ولا يعود المالك قادراً على الدخول. بياناته وعقاراته وكشوف حسابه تبقى كما هي، ويمكن إنشاء حساب جديد له لاحقاً."
                : "تُلغى كلمة مروره الحالية وتُولَّد كلمة مؤقتة تُعرض لك مرة واحدة. استخدمها عند نسيانه كلمة المرور."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction asChild>
              <button
                disabled={pending}
                onClick={(e) => {
                  e.preventDefault();
                  if (confirm === "remove") run(() => removeOwnerLogin(ownerId), "تم إلغاء حساب الدخول");
                  else run(() => resetOwnerPassword(ownerId));
                }}
                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
              >
                {confirm === "remove" ? "إلغاء الحساب" : "توليد كلمة مؤقتة"}
              </button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
