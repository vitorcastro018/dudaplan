import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["500", "700", "800"],
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "DudaPlan",
  description: "Controle de projetos, tarefas e reuniões com IA.",
};

export const viewport: Viewport = {
  themeColor: "#120e1f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${bricolage.variable} ${figtree.variable} ${jetbrainsMono.variable} h-full`}
    >
      <body className="bg-paper text-ink min-h-full antialiased">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--surface)",
              color: "var(--ink)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-md)",
              fontFamily: "var(--font-sans)",
            },
          }}
        />
      </body>
    </html>
  );
}
