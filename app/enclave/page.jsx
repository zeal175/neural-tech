import Hero from "@/components/enclave/hero/Hero";
import EnclaveBody from "@/components/enclave/EnclaveBody";
import SiteNav from "@/components/enclave/SiteNav";

export default function Page() {
  return (
    <main>
      <SiteNav />
      <Hero />
      <EnclaveBody />
    </main>
  );
}
