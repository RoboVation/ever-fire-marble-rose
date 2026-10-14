import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { useI18n } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { useResolvedTheme } from "@/lib/theme";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Gaman" },
      { name: "description", content: "Plan bus and train journeys across Sri Lanka. Sample corridors, clearly labelled." },
      { name: "theme-color", content: "#f3f1ec" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,560&family=Noto+Sans+Sinhala:wght@400;500;600&family=Noto+Sans+Tamil:wght@400;500;600&family=Outfit:wght@400;500;600&display=swap",
      },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: Root,
});

function Root() {
  const { t } = useI18n();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var p=JSON.parse(localStorage.getItem('gaman-prefs')||'{}');var s=p.state||{};var t=s.theme;var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',!!d);var l=s.lang;document.documentElement.lang=l==='si'?'si':l==='ta'?'ta':'en';if(s.textSize)document.documentElement.dataset.text=s.textSize;}catch(e){}",
          }}
        />
        <a href="#main" className="absolute top-2 left-4 z-50 -translate-y-16 rounded-md bg-primary px-3 py-2 text-primary-fg focus:translate-y-0">
          {t("skip")}
        </a>
        <PreviewHostBridge />
        <AuthProvider>
          <DocumentState />
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}

function DocumentState() {
  const lang = usePrefs((state) => state.lang);
  const textSize = usePrefs((state) => state.textSize);
  const theme = useResolvedTheme();
  useEffect(() => {
    document.documentElement.lang = lang === "si" ? "si" : lang === "ta" ? "ta" : "en";
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset.text = textSize;
  }, [lang, textSize, theme]);
  return null;
}
