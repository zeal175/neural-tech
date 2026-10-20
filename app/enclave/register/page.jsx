import SiteNav from "@/components/enclave/SiteNav";
import RegisterForm from "@/components/enclave/register/RegisterForm";
import { EVENT } from "@/lib/enclave/event";

export const metadata = {
  title: `Register — ${EVENT.name}`,
  description: `Register for ${EVENT.name}. Fee ${EVENT.fee}. Solo or duo — register individually; teams are formed on the day. Pay via UPI and get your entry pass.`,
};

export default function RegisterPage() {
  return (
    <main className="reg-page">
      <SiteNav />
      <div className="reg-page-shell">
        <RegisterForm />
      </div>
    </main>
  );
}
