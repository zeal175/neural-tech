"use client";

export default function SiteNav() {
  return (
    <header className="en-nav">
      <a className="en-nav-brand" href="/">
        <img src="/enclave/brand/neural-tech-logo-96.webp" alt="" width={28} height={30} />
        <span>Neural Tech</span>
      </a>
      <nav className="en-nav-links" aria-label="Site">
        <a href="/enclave">Entrance</a>
        <a href="/enclave/register">Register</a>
        <a href="/">Club site</a>
      </nav>
    </header>
  );
}
