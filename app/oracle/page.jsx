import Image from "next/image";
import Link from "next/link";
import SiteHeader from "@/app/components/SiteHeader";
import { ORACLE, ROOMS } from "@/lib/oracle/event";

export default function OraclePage() {
  const facts = [
    ["When", ORACLE.timeLabel ? `${ORACLE.dateLong}, ${ORACLE.timeLabel}` : ORACLE.dateLong],
    ["Where", `${ORACLE.venue}, Crescent`],
    ["Entry", `${ORACLE.fee} per person`],
    ["Prize pool", ORACLE.prize],
    ["How you play", ORACLE.format],
  ];

  return (
    <main className="or-page">
      <SiteHeader />
      <div className="or-grain" aria-hidden="true" />

      {/* the logo and the way in */}
      <section className="or-hero" id="top">
        <div className="or-rings" aria-hidden="true" />
        <h1 className="or-hero-logo">
          <Image src="/oracle/logo.png" alt={ORACLE.title} width={804} height={189} priority sizes="(max-width: 700px) 90vw, 56rem" />
        </h1>
        {ORACLE.registrationOpen ? (
          <a className="or-btn or-hero-cta" href={ORACLE.registerUrl} target="_blank" rel="noopener noreferrer">
            Register
          </a>
        ) : (
          <p className="or-osd or-sun">Registrations are closed</p>
        )}
      </section>

      {/* the brief, in the registration form's words */}
      <section className="or-tape" id="tape" aria-labelledby="or-brief">
        <div className="or-wrap">
          <h2 className="or-title" id="or-brief">
            Three levels. One exit.
          </h2>
          <p className="or-sub">
            ORACLE is a live contest staged like a show. You join from your laptop, but others are walking the same halls tonight. Three levels stand between you and the exit.
          </p>

          <ol className="or-rooms">
            {ROOMS.map((room) => (
              <li key={room.name} className="or-room">
                <span className="or-osd or-room-n">{room.tag}</span>
                <h3 className="or-room-name">{room.name}</h3>
                <div className="or-room-body">
                  <p className="or-room-line">{room.line}</p>
                  <p className="or-room-more">{room.more}</p>
                  <p className="or-room-needs">
                    <span className="or-osd">You’ll need</span> {room.needs}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <p className="or-rule">Every level opens with a free training tape. Credits are your score and your money. After each level, the bottom fifth faces the System Purge.</p>
        </div>
      </section>

      {/* the cassette label: every fact on one sticker, and how to get in */}
      <section className="or-entry" id="register" aria-labelledby="or-entry-h">
        <div className="or-wrap or-entry-grid">
          <figure className="or-label">
            <span className="or-label-bands" aria-hidden="true" />
            <figcaption className="or-label-hand">{ORACLE.title}</figcaption>
            <dl className="or-facts">
              {facts.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <span className="or-label-foot" aria-hidden="true">
              <span className="or-barcode" />
              NULL VOID
            </span>
          </figure>

          <div className="or-join">
            <h2 className="or-join-h" id="or-entry-h">
              {ORACLE.registrationOpen ? "Registrations are open" : "Registrations are closed"}
            </h2>
            {ORACLE.registrationOpen ? (
              <>
                <ol className="or-steps">
                  <li>Fill in the registration form. One form per person.</li>
                  <li>Pay the {ORACLE.fee} entry the form asks for.</li>
                </ol>
                <div className="or-actions">
                  <a className="or-btn" href={ORACLE.registerUrl} target="_blank" rel="noopener noreferrer">
                    Register
                  </a>
                </div>
              </>
            ) : (
              <p className="or-sub">See you in the hall. Photos go up in the gallery after the day.</p>
            )}
          </div>
        </div>
      </section>

      <footer className="or-foot">
        <div className="or-wrap">
          <p className="or-sealed">
            The doors are sealed until the Front Man calls your name<span className="or-cursor" aria-hidden="true" />
          </p>
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
