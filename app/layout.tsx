import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/contexts/WalletContext";
import { PinProvider } from "@/contexts/PinContext";
import Script from "next/script";
import { SidebarOverlay, GeometricShapes } from "./components/LayoutClient";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: "INJ Pass",
  description: "Passkey-powered wallet for Injective",
  icons: {
    icon: [
      { url: "/lambdalogo.png" },
      { url: "/lambdalogo.png", sizes: "32x32", type: "image/png" },
      { url: "/lambdalogo.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/lambdalogo.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 5.0,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&display=swap" rel="stylesheet" />
        <Script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js" strategy="beforeInteractive" />
      </head>
      <body className={`${inter.variable} ${spaceGrotesk.variable} antialiased`}>
        {/* Sidebar Overlay */}
        <SidebarOverlay />
        
        {/* Sidebar Container */}
        <div className="sidebar-container">
          {/* Sidebar content will be injected here */}
        </div>

        {/* Animated Background and Geometric Shapes */}
        <GeometricShapes />

        <PinProvider>
          <WalletProvider>{children}</WalletProvider>
        </PinProvider>
      </body>
    </html>
  );
}
