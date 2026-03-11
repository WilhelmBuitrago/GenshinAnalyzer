import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Genshin Artifact Analyzer Dashboard",
  description: "Dashboard científico para analizar artefactos de Genshin Impact"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="bg-background text-text antialiased">
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1f1f2a_0%,transparent_35%),#0f0f13] flex items-center justify-center px-4 py-10">
          {children}
        </div>
      </body>
    </html>
  );
}
