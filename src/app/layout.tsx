import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  icons: {
    icon: [{ url: "/brand/rose-mark.webp", type: "image/webp" }],
    apple: [{ url: "/brand/rose-mark.webp", type: "image/webp" }],
  },
  title: {
    default: "Bella Roses | بيلا روز",
    template: "%s | Bella Roses",
  },
  description: "قائمة رقمية فاخرة وتجربة ضيافة ذكية من Bella Roses.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
