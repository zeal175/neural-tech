import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@fontsource/poppins/900.css";
import "./globals.css";

export const metadata = {
  title: "Neural Tech — Build What Comes Next",
  description:
    "A community of curious minds exploring AI, emerging technology, and the ideas shaping tomorrow.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
