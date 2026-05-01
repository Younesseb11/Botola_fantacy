import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
import { TopNav } from "@/components/TopNav";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Botola Fantasy",
  description: "The ultimate Moroccan fantasy football experience.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-foreground`}>
        {/* We use max-w-md to emulate the mobile app layout seen in screenshots on desktop */}
        <main className="max-w-md mx-auto min-h-screen relative shadow-2xl bg-navy overflow-hidden">
          <div className="pb-[92px] h-screen overflow-y-auto w-full relative scroll-smooth">
            <TopNav />
            {children}
          </div>
          <BottomNav />
        </main>
      </body>
    </html>
  );
}
