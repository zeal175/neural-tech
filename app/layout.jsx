import { Poppins } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-poppins",
});

const screamer = localFont({
  src: "./fonts/FKScreamer-Bold.otf",
  weight: "700",
  variable: "--font-screamer",
  display: "swap",
});

const siteName = "Neural Tech";
const title = "Neural Tech — Not Your Average Tech Club";
const description =
  "A community of curious minds exploring AI, emerging technology, and the ideas shaping tomorrow.";

export const viewport = {
  viewportFit: "cover",
};

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://neuraltech.club"),
  title,
  description,
  applicationName: siteName,
  icons: {
    icon: [{ url: "/neural-tech-logo1.png", type: "image/png" }],
    apple: [{ url: "/neural-tech-logo1.png", type: "image/png" }],
    shortcut: "/neural-tech-logo1.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName,
    title,
    description,
    images: [
      {
        url: "/neural-tech-OG.png",
        width: 1733,
        height: 907,
        alt: "Neural Tech — retro arcade club visual with neon arcade cabinet and pixel icons",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/neural-tech-OG.png"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${poppins.variable} ${screamer.variable}`}>
      <body>{children}</body>
    </html>
  );
}
