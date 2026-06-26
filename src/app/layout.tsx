import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { BiometricGateProvider } from "@/components/auth/biometric-gate";
import { CookieConsent } from "@/components/legal/cookie-consent";
import { db } from "@/lib/db";
import { getSessionContext } from "@/lib/core/session";
import { Hammer, Mail, HelpCircle } from "lucide-react";
import { ExpiredCheckoutClient } from "@/components/public-site/expired-checkout-client";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const rows = await db.platformSetting.findMany({
    where: { key: { in: ["neyo_logo_url", "neyo_wordmark_light_url", "neyo_favicon_url", "neyo_favicon_32_url", "neyo_favicon_16_url", "neyo_icon_192_url", "neyo_apple_touch_icon_url"] } },
  }).catch(() => []);
  const setting = (key: string, fallback: string) => rows.find((row) => row.key === key)?.value || fallback;
  return {
    title: "NEYO — School Operating System",
    description: "Run your school's admissions, attendance, fees and academics in one calm, fast place. Built for Kenyan schools.",
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: "NEYO", statusBarStyle: "default" },
    icons: {
      icon: [
        { url: setting("neyo_favicon_url", "/favicon.ico"), sizes: "any" },
        { url: setting("neyo_favicon_32_url", "/favicon-32.png"), type: "image/png", sizes: "32x32" },
        { url: setting("neyo_favicon_16_url", "/favicon-16.png"), type: "image/png", sizes: "16x16" },
        { url: setting("neyo_icon_192_url", "/icon-192.png"), type: "image/png", sizes: "192x192" },
      ],
      apple: setting("neyo_apple_touch_icon_url", "/apple-touch-icon.png"),
    },
    openGraph: {
      title: "NEYO — School Operating System",
      description: "Built for Kenyan schools.",
      images: [setting("neyo_wordmark_light_url", setting("neyo_logo_url", "/icon-192.png"))],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1c2740",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check for Global Liquid Glass Operator Switch (Feature G.22 Toggle)
  const liquidSetting = await db.platformSetting.findUnique({ where: { key: "neyo_liquid_system_active" } }).catch(() => null);
  const isLiquidActive = liquidSetting ? liquidSetting.value === "true" : true; // Default true!

  // Check for System-Wide Maintenance Mode
  const [maintenanceSetting, maintenanceMessageSetting, maintenanceEtaSetting] = await Promise.all([
    db.platformSetting.findUnique({ where: { key: "maintenance_mode" } }).catch(() => null),
    db.platformSetting.findUnique({ where: { key: "maintenance_message" } }).catch(() => null),
    db.platformSetting.findUnique({ where: { key: "maintenance_eta" } }).catch(() => null),
  ]);
  const isMaintenanceActive = maintenanceSetting?.value === "true";
  const maintenanceMessage = maintenanceMessageSetting?.value || "We are currently conducting scheduled upgrades and maintenance on NEYO School OS. The platform will be back online shortly with improved speed and reliability.";
  const maintenanceEta = maintenanceEtaSetting?.value || "Back shortly";

  const sessionCtx = await getSessionContext().catch(() => null);
  const isSuperAdmin = sessionCtx?.user?.role === "SUPER_ADMIN";

  // Check for School OS Subscription Expiration / Lockouts (Automated Lockout)
  let isExpired = false;
  let schoolName = "";
  let price = 15000;
  let tenantId = "";

  if (sessionCtx?.user?.tenantId && !isSuperAdmin) {
    tenantId = sessionCtx.user.tenantId;
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      include: { subscription: true },
    }).catch(() => null);

    if (tenant) {
      schoolName = tenant.name;
      const sub = tenant.subscription;
      price = sub ? sub.grandfatheredPrice : 15000;

      if (sub) {
        isExpired = sub.status === "SUSPENDED" || Boolean(
          sub.status === "GRACE" && sub.graceEndsAt && sub.graceEndsAt < new Date()
        );
      }
    }
  }

  return (
    <html lang="en" className={isLiquidActive ? "glass" : "flat"} data-liquid="2" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var d=document.documentElement,t=localStorage.getItem("neyo-theme"),ge=localStorage.getItem("neyo-liquid-enabled")!=="false";if(t==="light"){d.classList.remove("glass");d.classList.add("flat");d.classList.remove("dark")}else if(t==="dark"){d.classList.remove("glass");d.classList.add("flat");d.classList.add("dark")}else if(t==="glass-dark"){if(ge){d.classList.add("glass");d.classList.remove("flat")}else{d.classList.remove("glass");d.classList.add("flat")}d.classList.add("dark")}else if(!t){var prefersDark=window.matchMedia("(prefers-color-scheme: dark)").matches;if(!ge){d.classList.remove("glass");d.classList.add("flat")}if(prefersDark){d.classList.add("dark")}else{d.classList.remove("dark")}}else if(!ge){d.classList.remove("glass");d.classList.add("flat")}var l=localStorage.getItem("neyo-liquid");if(l==="1"||l==="2"||l==="3")d.setAttribute("data-liquid",l);var li=Number(localStorage.getItem("neyo-liquid-intensity")||50);if(!isNaN(li)){li=Math.max(0,Math.min(100,li));d.style.setProperty("--lg-user-blur-boost",Math.round((li-50)/5)+"px");d.style.setProperty("--lg-user-sheen-extra",Math.max(0,(li-50)/250).toFixed(2))}var devId=localStorage.getItem("neyo-device-id");if(!devId){devId="dev_"+Math.random().toString(36).substr(2,9)+"_"+Date.now();localStorage.setItem("neyo-device-id",devId)}document.cookie="neyo_device_id="+devId+"; path=/; max-age=31536000; SameSite=Lax"}catch(e){}`,
          }}
        />
      </head>
      <body className={inter.variable} suppressHydrationWarning>
        <ToastProvider>
          <BiometricGateProvider>
            {isMaintenanceActive && !isSuperAdmin ? (
              /* Beautiful Liquid Glass Maintenance Mode Screen */
              <div className="flex min-h-screen flex-col items-center justify-center bg-warm-100 px-4 text-center dark:bg-navy-950 font-sans">
                <div className="w-full max-w-md rounded-3xl border border-white/70 bg-white/70 p-8 shadow-pop backdrop-blur-xl dark:border-white/10 dark:bg-navy-900/60">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                    <Hammer className="h-7 w-7 animate-pulse" />
                  </div>
                  
                  <h1 className="mt-5 text-xl font-bold tracking-tight text-navy-950 dark:text-white">
                    NEYO Operations Upgrade
                  </h1>
                  
                  <p className="mt-3 text-sm text-navy-600 dark:text-navy-300 leading-relaxed">
                    {maintenanceMessage}
                  </p>

                  <div className="mt-6 rounded-2xl border border-navy-50 bg-navy-50/50 p-4 text-left dark:border-navy-800 dark:bg-navy-950/40">
                    <p className="text-xs font-bold uppercase tracking-wider text-green-700 dark:text-green-400 flex items-center gap-1.5">
                      🦉 Bundi is on the case
                    </p>
                    <p className="mt-1 text-xs text-navy-500 dark:text-navy-400">
                      Bundi is supervising our platform-wide updates. Estimated return: {maintenanceEta}.
                    </p>
                  </div>

                  <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4 text-xs text-navy-400 dark:text-navy-500 border-t border-navy-100 pt-5 dark:border-navy-800">
                    <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> support@neyo.co.ke</span>
                    <span className="flex items-center gap-1"><HelpCircle className="h-3.5 w-3.5" /> status.neyo.co.ke</span>
                  </div>
                </div>
                <p className="mt-6 text-xs text-navy-400 dark:text-navy-600 uppercase tracking-[0.2em] font-bold">
                  Powered by NEYO
                </p>
              </div>
            ) : isExpired ? (
              /* Automated SaaS Billing Expired lock screen with M-Pesa dynamic triggers */
              <ExpiredCheckoutClient
                tenantId={tenantId}
                schoolName={schoolName}
                price={price}
              />
            ) : (
              children
            )}
            <CookieConsent />
          </BiometricGateProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
