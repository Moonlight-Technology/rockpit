import { LoginForm } from "@/components/login-form";
import { Badge } from "@/components/ui/badge";
import type { PageProps } from "next";

type LoginPageProps = PageProps<"/login">;

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const rawCallbackUrl = params?.callbackUrl;
  const callbackUrl = Array.isArray(rawCallbackUrl) ? (rawCallbackUrl[0] ?? "/") : (rawCallbackUrl ?? "/");

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
