import dynamic from "next/dynamic";
import Hero from "@/components/enclave/hero/Hero";
import SiteNav from "@/components/enclave/SiteNav";

const EnclaveBody = dynamic(() => import("@/components/enclave/EnclaveBody"), {
  loading: () => <div className="en-page" aria-hidden="true" style={{ minHeight: "60vh" }} />,
});

export default function Page() {
  return (
    <main>
      <SiteNav />
      <Hero />
      <EnclaveBody />
    </main>
  );
}
