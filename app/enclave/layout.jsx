import { JetBrains_Mono, Montserrat, Poppins, Press_Start_2P, Six_Caps } from "next/font/google";
import localFont from "next/font/local";
import { EVENT } from "@/lib/enclave/event";
import "./enclave.css";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-jb",
});

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

const pillar = localFont({
  src: "../fonts/Pillar.otf",
  weight: "400",
  variable: "--font-pillar",
  display: "block",
});

const title = `${EVENT.name} — ${EVENT.department}${EVENT.dateSet ? ` · ${EVENT.date}` : ""}`;
const description = `${EVENT.name} by ${EVENT.club}, ${EVENT.department}, ${EVENT.institution}. ${EVENT.dateLong}${
  EVENT.venueSet ? `, ${EVENT.venue}` : ""
}. Register for your entry pass.`;

export const metadata = {
  title,
  description,
  icons: {
    icon: [{ url: "/enclave/brand/icon-48.png", type: "image/png", sizes: "48x48" }],
    apple: [{ url: "/enclave/brand/apple-icon-180.png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    title,
    description,
    siteName: EVENT.name,
    url: "/enclave",
  },
  twitter: { card: "summary_large_image", title, description },
};

export default function EnclaveLayout({ children }) {
  return (
    <div
      className={`enclave-root ${mono.variable} ${poppins.variable} ${montserrat.variable} ${pixel.variable} ${sixCaps.variable} ${pillar.variable}`}
    >
      {children}
    </div>
  );
}
