import { JetBrains_Mono, Montserrat, Poppins, Press_Start_2P, Six_Caps } from "next/font/google";
import localFont from "next/font/local";
import { EVENT } from "@/lib/event";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-poppins",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-montserrat",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-jb",
});

const pixel = Press_Start_2P({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-pixel",
});

const sixCaps = Six_Caps({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-six-caps",
});

const screamer = localFont({
  src: "./fonts/FKScreamer-Bold.otf",
  weight: "700",
  variable: "--font-screamer",
  display: "swap",
});

// the ENCLAVE wordmark (Pillar by Pian45 Studio; free version is personal use only, see README)
const pillar = localFont({
  src: "./fonts/Pillar.otf",
  weight: "400",
  variable: "--font-pillar",
  display: "block", // the giant title must never flash in a fallback font
});

// (date and venue come from lib/event.js and are left out until they are set)
const title = `${EVENT.name} — ${EVENT.department}${EVENT.dateSet ? ` · ${EVENT.date}` : ""}`;
const description = `${EVENT.name} by ${EVENT.club}, ${EVENT.department}, ${EVENT.institution}. ${EVENT.dateLong}${
  EVENT.venueSet ? `, ${EVENT.venue}` : ""
}. Register for your entry pass.`;

// Absolute base for link-preview images: explicit env, else Vercel's production domain.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
  "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  icons: {
    icon: [{ url: "/brand/icon-48.png", type: "image/png", sizes: "48x48" }],
    apple: [{ url: "/brand/apple-icon-180.png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    title,
    description,
    siteName: EVENT.name,
    // the preview image is app/opengraph-image.jsx (built from the same settings)
  },
  twitter: { card: "summary_large_image", title, description },
};

export const viewport = {
  themeColor: "#070605",
  colorScheme: "dark",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${montserrat.variable} ${screamer.variable} ${pillar.variable} ${mono.variable} ${pixel.variable} ${sixCaps.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
