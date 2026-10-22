import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Program Command Center",
  description: "Salesforce delivery program dashboard (sample data)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
