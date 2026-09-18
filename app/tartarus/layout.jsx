import { VT323 } from "next/font/google";
import "./tartarus.css";

const vt323 = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-vt323",
});

const title = "TARTARUS — Neural Tech";
const description =
  "One day. Four challenges. No safety net. The record of Neural Tech’s live AI competition — now complete, with the photos in the archive.";

export const metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    url: "/tartarus",
  },
  twitter: {
    title,
    description,
  },
};

export default function TartarusLayout({ children }) {
  return (
    <div className={`tartarus ${vt323.variable}`}>
      <div className="tartarus-scan" aria-hidden="true" />
      <div className="tartarus-noise" aria-hidden="true" />
      {children}
    </div>
  );
}
