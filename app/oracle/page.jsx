import Image from "next/image";
import Link from "next/link";
import SiteHeader from "@/app/components/SiteHeader";
import { ORACLE } from "@/lib/oracle/event";

export default function OraclePage() {
  return (
    <main className="or-page">
      <SiteHeader />
      <div className="or-grain" aria-hidden="true" />

      <section className="or-notice" id="top" aria-labelledby="or-notice-h">
        <div className="or-rings" aria-hidden="true" />
        <Image
          className="or-notice-logo"
          src="/oracle/logo.png"
          alt={ORACLE.title}
          width={804}
          height={189}
          priority
          sizes="(max-width: 700px) 80vw, 32rem"
        />

        <article className="or-letter">
          <p className="or-letter-tag">Postponed</p>
          <h1 className="or-letter-h" id="or-notice-h">
            We are deeply sorry.
          </h1>
          <p>
            {ORACLE.title}, planned for {ORACLE.dateLong} at the {ORACLE.venue}, has been postponed to a later date
            due to unforeseeable reasons.
          </p>
          <p>
            This is not the news we wanted to share, and it is not a decision we made lightly. We apologise for any
            inconvenience it causes.
          </p>
          <p>Thank you for your understanding, and once again, we are sorry for doing this.</p>
          <p className="or-letter-sign">— {ORACLE.club}</p>
        </article>
      </section>

      <footer className="or-foot">
        <div className="or-wrap">
          <div className="or-credits">
            <p>
              {ORACLE.club} and the {ORACLE.department}, {ORACLE.institution}, with the {ORACLE.partner}.
            </p>
            <nav className="or-links" aria-label="Neural Tech">
              <Link href="/">Neural Tech</Link>
              <Link href="/events">All events</Link>
              <Link href="/gallery">Gallery</Link>
            </nav>
          </div>
        </div>
      </footer>
    </main>
  );
}
