import type { Metadata } from "next";
import { IBM_Plex_Sans, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const sourceSerif4 = Source_Serif_4({
  variable: "--font-source-serif-4",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Versus — Entraînement à la traduction",
  description:
    "Versus vous aide à progresser en traduction grâce à des exercices générés sur mesure, une correction détaillée et un deck de révision à répétition espacée.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${ibmPlexSans.variable} ${sourceSerif4.variable} h-full`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
