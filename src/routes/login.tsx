import { createFileRoute, Link } from "@tanstack/react-router";
import { SignInGate } from "@/lib/auth/gates";
import { GROK_PROVIDERS, signIn } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/login")({
  component: Login,
});

function Login() {
  const { t } = useI18n();
  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-bg px-6 text-fg">
      <div className="grid w-full max-w-sm gap-4">
        <p className="font-display text-3xl tracking-tight">Gaman</p>
        <h1 className="text-lg font-medium">{t("signIn")}</h1>
        <SignInGate
          fallback={
            <div className="grid gap-2">
              {GROK_PROVIDERS.map((provider) => (
                <Button key={provider.providerId} variant="secondary" onClick={() => signIn(provider.providerId, { callbackURL: "/you" })}>
                  {t("continueWith")} {provider.label}
                </Button>
              ))}
            </div>
          }
        >
          <p>{t("alreadySignedIn")}</p>
          <Button asChild>
            <Link to="/">{t("backHome")}</Link>
          </Button>
        </SignInGate>
      </div>
    </main>
  );
}
