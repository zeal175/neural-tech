import { Archivo, Bitcount_Prop_Single, Yellowtail } from "next/font/google";
import { vt323 } from "@/app/gallery/fonts";
import { ORACLE } from "@/lib/oracle/event";
import "./oracle.css";

// the poster's wide grotesk (date, "Department of CSE"); the width axis gives the expanded cut
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
});

// the marker hand on the cassette label
const yellowtail = Yellowtail({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-yellowtail",
});

// the postponement notice
const bitcount = Bitcount_Prop_Single({
  subsets: ["latin"],
  variable: "--font-bitcount",
  // Next ships no fallback metrics for Bitcount
  adjustFontFallback: false,
});

const title = `${ORACLE.title} · Postponed`;
const description = `${ORACLE.title} has been postponed to a later date due to unforeseeable reasons. We're deeply sorry.`;

export const metadata = {
  title,
  description,
  openGraph: {
    type: "website",
    title,
    description,
    siteName: ORACLE.title,
    url: "/oracle",
    images: [{ url: "/oracle/og.jpg", width: 1200, height: 630, alt: "ORACLE: Ascension, 12.11.26, CIIC Seminar Hall" }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/oracle/og.jpg"] },
};

export const viewport = {
  themeColor: "#050506",
};

export default function OracleLayout({ children }) {
  return (
    <div className={`oracle ${archivo.variable} ${vt323.variable} ${yellowtail.variable} ${bitcount.variable}`}>{children}</div>
  );
}
