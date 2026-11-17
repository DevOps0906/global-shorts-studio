import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { HeaderGate } from "@/components/header-gate";

export const metadata: Metadata = {
  title: "글로벌쇼츠 스튜디오",
  description: "글로벌 쇼츠 제작 스튜디오",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <HeaderGate>
          <SiteHeader />
        </HeaderGate>
        <div className="flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
