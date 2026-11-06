import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Noto_Serif_JP, Shippori_Mincho_B1 } from "next/font/google";
import "./globals.css";

const mincho = Shippori_Mincho_B1({
  weight: ["500", "600", "700"],
  variable: "--font-mincho",
  preload: false,
  display: "swap",
});
const serif = Noto_Serif_JP({
  weight: ["400", "500", "700"],
  variable: "--font-noto-serif",
  preload: false,
  display: "swap",
});
const cormorant = Cormorant_Garamond({
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-cormorant",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "情報屋アジト", template: "%s | 情報屋アジト" },
  description: "紹介された人だけが入れる、仲間内の情報交換所",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0d1a16",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${mincho.variable} ${serif.variable} ${cormorant.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
