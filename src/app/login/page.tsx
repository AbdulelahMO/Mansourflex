import { Building2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage(props: PageProps<"/login">) {
  const params = await props.searchParams;
  const callbackUrl = typeof params.callbackUrl === "string" ? params.callbackUrl : "/";
  // Sent here by the session guard: the account behind the token was stopped or is gone, and
  // being returned to a sign-in screen with no explanation reads as the system having broken.
  const ended = params.ended === "1";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Building2 className="size-6 text-primary" />
          </div>
          <CardTitle className="text-xl">نظام إدارة الأملاك العقارية</CardTitle>
          <CardDescription>سجّل الدخول للمتابعة</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {ended && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              انتهت جلستك لأن حسابك لم يعد موجوداً أو أُوقف. سجّل الدخول من جديد، وإن تكرر ذلك فراجع مدير
              النظام.
            </p>
          )}
          <LoginForm callbackUrl={callbackUrl} />
        </CardContent>
      </Card>
    </div>
  );
}
