import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowDownRight, ArrowRight, Menu, X } from "lucide-react";
import "./styles.css";

const events = [
  { day: "18", month: "SEP", type: "WORKSHOP", title: "Build Your First Neural Network", meta: "Lab 04 · 6:00 PM" },
  { day: "26", month: "SEP", type: "TALK", title: "AI Beyond the Hype", meta: "Auditorium · 5:30 PM" },
  { day: "04", month: "OCT", type: "HACK NIGHT", title: "Ship Something Strange", meta: "Studio B · 8:00 PM" },
];

const pillars = [
  {
    number: "01",
    title: "Learn in public",
    copy: "Hands-on workshops, research jams, and honest conversations with people building the future.",
  },
  {
    number: "02",
    title: "Build together",
    copy: "Find collaborators, turn half-formed ideas into prototypes, and make things worth sharing.",
  },
  {
    number: "03",
    title: "Stay curious",
    copy: "No gatekeeping and no prerequisites. Just a bias toward asking better questions and trying.",
  },
];

function App() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const closeMenu = () => setMenuOpen(false);
    window.addEventListener("resize", closeMenu);
    return () => window.removeEventListener("resize", closeMenu);
  }, []);

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Neural Tech home">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          NEURAL TECH
        </a>

        <button
          className="menu-toggle"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-label="Toggle navigation"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        <nav className={menuOpen ? "nav-open" : ""} aria-label="Main navigation">
          <a href="#about" onClick={() => setMenuOpen(false)}>About</a>
          <a href="#events" onClick={() => setMenuOpen(false)}>Events</a>
          <a href="#community" onClick={() => setMenuOpen(false)}>Community</a>
          <a href="#contact" onClick={() => setMenuOpen(false)}>Contact</a>
        </nav>

        <a className="button button-small header-cta" href="#join">
          Join the club <ArrowDownRight size={15} />
        </a>
      </header>

      <section className="hero" id="top">
        <div className="hero-art" aria-hidden="true" />
        <div className="hero-grain" aria-hidden="true" />
        <div className="hero-copy">
          <p className="eyebrow"><span>●</span> Humans building with machines</p>
          <h1>Build what<br />comes <em>next.</em></h1>
          <p className="hero-subtitle">
            A campus club for curious minds exploring AI, emerging tech, and the ideas
            shaping tomorrow.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#join">
              Join Neural Tech <ArrowRight size={17} />
            </a>
            <a className="text-link" href="#events">
              Explore events <ArrowDownRight size={16} />
            </a>
          </div>
        </div>
        <span className="side-note">EST. 2026 — SIGNAL FOUND</span>
        <span className="scroll-note">SCROLL TO EXPLORE <ArrowDownRight size={14} /></span>
      </section>

      <section className="ticker" aria-label="Club highlights">
        <div>
          <span>WORKSHOPS</span><b>✦</b><span>RESEARCH</span><b>✦</b>
          <span>HACK NIGHTS</span><b>✦</b><span>COMMUNITY</span><b>✦</b>
          <span>WORKSHOPS</span><b>✦</b><span>RESEARCH</span><b>✦</b>
        </div>
      </section>

      <section className="intro section-pad" id="about">
        <div className="section-label">
          <span>01</span>
          <p>THE SIGNAL</p>
        </div>
        <div className="intro-content">
          <p className="eyebrow"><span>●</span> Our point of view</p>
          <h2>Technology moves fast.<br /><em>We move together.</em></h2>
          <p className="intro-copy">
            Neural Tech is a playground for builders, thinkers, artists, and researchers.
            We make complex ideas approachable, then make something real with them.
          </p>
          <a className="text-link coral" href="#community">
            Meet the community <ArrowRight size={16} />
          </a>
        </div>
        <div className="signal-orbit" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <span>NT</span>
          <i />
        </div>
      </section>

      <section className="events section-pad" id="events">
        <div className="section-heading">
          <div>
            <p className="eyebrow"><span>●</span> Incoming transmissions</p>
            <h2>What’s happening</h2>
          </div>
          <a className="text-link" href="#all-events">View all events <ArrowRight size={16} /></a>
        </div>

        <div className="event-list">
          {events.map((event) => (
            <article className="event-card" key={event.title}>
              <div className="event-date">
                <strong>{event.day}</strong>
                <span>{event.month}</span>
              </div>
              <div className="event-info">
                <p>{event.type}</p>
                <h3>{event.title}</h3>
                <span>{event.meta}</span>
              </div>
              <a href="#join" aria-label={`Learn more about ${event.title}`}>
                <ArrowDownRight size={24} />
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="community section-pad" id="community">
        <div className="section-label">
          <span>02</span>
          <p>WHY NEURAL TECH</p>
        </div>
        <div className="community-heading">
          <p className="eyebrow"><span>●</span> Powered by people</p>
          <h2>Find your people.<br /><em>Make your mark.</em></h2>
        </div>
        <div className="pillars">
          {pillars.map((pillar) => (
            <article key={pillar.number}>
              <span className="pillar-number">{pillar.number}</span>
              <div className="pixel-icon" aria-hidden="true"><i /><i /><i /><i /></div>
              <h3>{pillar.title}</h3>
              <p>{pillar.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="join section-pad" id="join">
        <p className="eyebrow"><span>●</span> Your next move</p>
        <h2>Ready to enter<br />the <em>network?</em></h2>
        <p>Come to an event, share an idea, or just say hello. The door is open.</p>
        <a className="button button-dark" href="mailto:hello@neuraltech.club">
          Become a member <ArrowRight size={18} />
        </a>
        <div className="join-code" aria-hidden="true">01001110<br />01010100</div>
      </section>

      <footer id="contact">
        <a className="brand footer-brand" href="#top">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          NEURAL TECH
        </a>
        <p>IDEAS IN. SIGNAL OUT.</p>
        <div>
          <a href="mailto:hello@neuraltech.club">Email</a>
          <a href="#instagram">Instagram</a>
          <a href="#discord">Discord</a>
        </div>
        <span>© 2026 NEURAL TECH</span>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
