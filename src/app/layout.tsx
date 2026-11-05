import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/auth";
import { NotificationProvider } from "@/contexts/notifications";
import { getSessionUser } from "@/lib/session";
import { SCRIPT_TEMA } from "@/lib/tema";

// Inter es la tipografía del diseño: openspec/*.svg usan font-family="Inter" en
// todos los nodos de texto (ver odd/tasks/design-alignment.md).
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Arnold Gym",
  description: "Gestión de gimnasio",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getSessionUser();
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Síncrono a propósito: resuelve cookie/sistema antes del primer paint (Next,
            "Preventing flash before hydration"). `next/script` lo encola y puede parpadear. */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
        <AuthProvider initialUser={user}>
          <NotificationProvider>{children}</NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
