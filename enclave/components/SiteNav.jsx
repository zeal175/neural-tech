"use client";

const CLUB_URL = process.env.NEXT_PUBLIC_CLUB_URL || "http://localhost:3000";

export default function SiteNav() {
  return (
    <header className="en-nav">
      <a className="en-nav-brand" href={CLUB_URL}>
        <img src="/brand/neural-tech-logo-96.webp" alt="" width={28} height={30} />
        <span>Neural Tech</span>
      </a>
      <nav className="en-nav-links" aria-label="Site">
        <a href="/">Entrance</a>
        <a href="/register">Register</a>
        <a href={CLUB_URL}>Club site</a>
      </nav>
    </header>
  );
}
