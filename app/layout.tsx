import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description =
  "Яркая пошаговая артиллерия: наводите орудие, учитывайте ветер и перекраивайте поле боя каждым выстрелом.";

function getRequestOrigin(headerStore: Headers): string {
  const forwardedHost = headerStore.get("x-forwarded-host")?.split(",")[0];
  const host = forwardedHost?.trim() || headerStore.get("host");
  const forwardedProtocol = headerStore
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();

  if (!host) {
    return "http://localhost:3000";
  }

  const hostname = host.split(":")[0]?.toLowerCase();
  const isLocalHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]";
  const protocol =
    forwardedProtocol === "http" || forwardedProtocol === "https"
      ? forwardedProtocol
      : isLocalHost
        ? "http"
        : "https";

  try {
    return new URL(`${protocol}://${host}`).origin;
  } catch {
    return "http://localhost:3000";
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const origin = getRequestOrigin(await headers());
  const socialImage = new URL("/og.png", origin).toString();

  return {
    title: "AFTERGLOW // ARTILLERY",
    description,
    applicationName: "Afterglow Artillery",
    icons: {
      icon: "/favicon.svg",
    },
    openGraph: {
      title: "AFTERGLOW // ARTILLERY",
      description:
        "Пошаговая браузерная артиллерия с разрушаемым рельефом и выразительными эффектами оружия.",
      type: "website",
      locale: "ru_RU",
      url: origin,
      images: [
        {
          url: socialImage,
          width: 1734,
          height: 907,
          alt: "Afterglow Artillery — два танка и три яркие траектории над разрушаемым полем боя",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "AFTERGLOW // ARTILLERY",
      description:
        "Пошаговая браузерная артиллерия с разрушаемым рельефом и выразительными эффектами оружия.",
      images: [socialImage],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#090b0d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
