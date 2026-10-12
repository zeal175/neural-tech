import SiteNav from "@/components/SiteNav";
import RegisterForm from "@/components/register/RegisterForm";
import { EVENT } from "@/lib/event";

export const metadata = {
  title: `Register — ${EVENT.name}`,
  description: `Register for ${EVENT.name}. Fee ${EVENT.fee}. Solo or duo. Pay via UPI and get your entry pass.`,
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
