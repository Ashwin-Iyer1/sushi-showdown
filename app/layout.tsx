import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Sushi Showdown · Live scoreboard",
  description: "Add your name, count your sushi, and follow the shared competition scoreboard. No sign-in needed.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
