"use client";

import { LoginForm } from "@/components/login-form";
import { Badge } from "@/components/ui/badge";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-[linear-gradient(180deg,#f9fafc_0%,#f2f5fb_100%)] p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="mb-3 flex justify-center">
          <Badge variant="secondary">RockPit</Badge>
        </div>
        <LoginForm callbackUrl={callbackUrl} />
      </div>
    </div>
  );
}
