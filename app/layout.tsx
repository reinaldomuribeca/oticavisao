import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sorteio AO VIVO — Ótica Visão",
  description:
    "Cadastre-se gratuitamente e concorra ao sorteio AO VIVO da Ótica Visão. Quinta, 07/05 às 20h.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000",
  ),
  openGraph: {
    title: "Sorteio AO VIVO — Ótica Visão",
    description:
      "Cadastro grátis. 1 número garantido + 5 números por amigo indicado. AO VIVO 07/05 às 20h.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${poppins.variable} dark`}>
      <body className="min-h-screen bg-ink-950 font-sans text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
