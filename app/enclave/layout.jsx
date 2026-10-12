import "./enclave.css";

const title = "ENCLAVE — Neural Tech";
const description =
  "Enclave is Neural Tech’s next live day. Solo or a team of two. Date soon. Crescent.";

export const metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    url: "/enclave",
    images: [{ url: "/enclave/cover.png", width: 2160, height: 2700, alt: "ENCLAVE" }],
  },
  twitter: { title, description, images: ["/enclave/cover.png"] },
};

export const viewport = {
  themeColor: "#070605",
  colorScheme: "dark",
};

export default function EnclaveLayout({ children }) {
  return (
    <div className="enclave">
      <div className="e-grain" aria-hidden="true" />
      {children}
    </div>
  );
}
