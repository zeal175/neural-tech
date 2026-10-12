// Link-preview image (WhatsApp, Instagram, X...), built at deploy time from lib/event.js, so the
// date and venue in previews always match the site. The figure is public/pass/og-bust.png
// (npm run pass-art); the type is the site's own Pillar and Screamer.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { EVENT } from "@/lib/event";

export const alt = `${EVENT.name} · ${EVENT.department}, ${EVENT.institution}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#070605";
const EMBER = "#fb7558";
const CREAM = "#f5ebdd";

export default async function OpengraphImage() {
  const root = process.cwd();
  const [pillar, screamer, bust] = await Promise.all([
    readFile(path.join(root, "app/fonts/Pillar.otf")),
    readFile(path.join(root, "app/fonts/FKScreamer-Bold.otf")),
    readFile(path.join(root, "public/pass/og-bust.png")),
  ]);
  const label = { fontFamily: "Screamer", fontSize: 24, letterSpacing: 2, textTransform: "uppercase" };
  const place = EVENT.venueSet ? `${EVENT.venue} · ${EVENT.institution}` : EVENT.institution;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: INK, color: CREAM }}>
        {/* red halo behind the head */}
        <div
          style={{
            position: "absolute",
            left: 300,
            top: -60,
            width: 600,
            height: 600,
            display: "flex",
            backgroundImage: "radial-gradient(circle, rgba(255,59,31,0.22), rgba(255,59,31,0) 70%)",
          }}
        />
        {/* ENCLAVE behind the figure, like the hero */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: -12,
            display: "flex",
            justifyContent: "center",
            fontFamily: "Pillar",
            fontSize: 500,
            lineHeight: 1,
            color: EMBER,
          }}
        >
          {EVENT.name}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img
          src={`data:image/png;base64,${bust.toString("base64")}`}
          width={480}
          height={600}
          style={{ position: "absolute", left: 360, top: 34 }}
        />
        <div style={{ position: "absolute", left: 48, top: 36, display: "flex", ...label, color: "rgba(245,235,221,0.8)" }}>
          {EVENT.club}
        </div>
        <div style={{ position: "absolute", left: 48, bottom: 40, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", ...label, fontSize: 22, color: "rgba(245,235,221,0.6)" }}>{`${EVENT.department} presents`}</div>
          <div style={{ display: "flex", fontFamily: "Screamer", fontSize: 128, lineHeight: 0.9, color: EMBER, marginTop: 6 }}>
            {EVENT.date}
          </div>
          <div style={{ display: "flex", ...label, fontSize: 22, color: "rgba(245,235,221,0.6)", marginTop: 10 }}>
            {EVENT.dateSet ? place : `${EVENT.dateLong} · ${place}`}
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            right: 48,
            bottom: 48,
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "18px 30px",
            borderRadius: 999,
            background: EMBER,
            color: INK,
            ...label,
            fontSize: 30,
            letterSpacing: 1,
          }}
        >
          {EVENT.registrationOpen ? "Register now" : "Registrations closed"}
          <div style={{ width: 12, height: 12, borderRadius: 999, background: INK, display: "flex" }} />
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Pillar", data: pillar, weight: 400, style: "normal" },
        { name: "Screamer", data: screamer, weight: 700, style: "normal" },
      ],
    }
  );
}
