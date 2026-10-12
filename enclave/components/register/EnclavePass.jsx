"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useHero } from "@/components/hero/heroStore";
import { EVENT } from "@/lib/event";
import { drawPass, passBlob } from "./drawPass";
import { clearPass } from "./passStorage";

/** entry: { entry: "solo" | "team", teamName, passes: [theirs, teammate's], returning } */
export default function EnclavePass({ entry, onDone, onReset }) {
  const team = entry.entry === "team" && entry.passes.length > 1;
  const me = entry.passes[0];
  const mate = team ? entry.passes[1] : null;
  const first = me.name.split(" ")[0];
  const mateFirst = mate ? mate.name.split(" ")[0] : "";
  // which pass is on screen: 0 = theirs, 1 = their teammate's
  const [shown, setShown] = useState(0);
  useEffect(() => setShown(0), [entry]);
  const pass = useMemo(
    () => ({ ...(entry.passes[shown] || me), teamName: team ? entry.teamName : "" }),
    [entry, shown, me, team]
  );
  const forMate = shown === 1;

  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [canShare, setCanShare] = useState(false);
  // phones: the share sheet is how a picture gets into the photo gallery ("Save image"), or to
  // the teammate, so there it is the main action; a plain download lands in Files / Downloads
  const [touch, setTouch] = useState(false);
  useEffect(() => setTouch(matchMedia("(pointer: coarse)").matches), []);
  const shareFirst = canShare && touch;
  const setHero = useHero((s) => s.set);
  // the PNG, made once the pass is drawn: Safari only opens the share sheet straight from the
  // tap, so share() must not wait on canvas.toBlob first
  const fileRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setCanShare(false);
    fileRef.current = null;
    drawPass(canvasRef.current, pass).then(async () => {
      if (cancelled) return;
      setReady(true);
      const blob = await passBlob(canvasRef.current);
      if (cancelled || !blob) return;
      const file = new File([blob], `ENCLAVE-pass-${pass.passId}.png`, { type: "image/png" });
      fileRef.current = file;
      setCanShare(!!navigator.canShare?.({ files: [file] }));
    });
    return () => {
      cancelled = true;
    };
  }, [pass]);

  const download = async () => {
    const blob = fileRef.current || (await passBlob(canvasRef.current));
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ENCLAVE-pass-${pass.passId}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const when = EVENT.dateSet ? ` on ${EVENT.dateLong}` : "";
  const share = async () => {
    const file = fileRef.current;
    if (!file) return download();
    const text = forMate
      ? `Your ${EVENT.name} pass, ${mateFirst}. Team ${entry.teamName}. Show the QR at the entrance${when}.`
      : team
        ? `We’re in. ${EVENT.name} · Team ${entry.teamName}${when}`
        : `I'm in. ${EVENT.name}${when}`;
    try {
      await navigator.share({ files: [file], title: `${EVENT.name} pass`, text });
    } catch (error) {
      // dismissed the share sheet: nothing to do; anything else: fall back to a download
      if (error?.name !== "AbortError") download();
    }
  };

  const notMe = () => {
    clearPass();
    if (onReset) onReset();
    else setHero({ pass: null, panel: "form" });
  };

  return (
    <div className="mt-5 flex flex-col gap-5">
      <div>
        <h2 id="reg-title" className="font-display text-[clamp(2.4rem,4.4vw,3.4rem)] uppercase leading-[0.88]">
          {entry.returning ? `Welcome back, ${first}.` : `You’re in, ${first}.`}
        </h2>
        {team ? (
          <p className="mt-2 text-[0.88rem] leading-[1.55] text-cream/60">
            {entry.returning ? "You’re already registered. " : ""}
            Team <span className="text-cream">{entry.teamName}</span>, with {mate.name}: a pass each. Send {mateFirst} theirs,
            or they can get it here by entering their own RRN. Show the QR at the entrance{when || " on the day"}.
          </p>
        ) : (
          <p className="mt-2 text-[0.88rem] leading-[1.55] text-cream/60">
            {entry.returning ? "You’re already registered; here’s your pass. " : ""}
            Pass <span className="font-mono text-cream">{me.passId}</span>. Show the QR at the entrance{when || " on the day"}.
          </p>
        )}
      </div>

      {team ? (
        <div className="grid grid-cols-2 gap-1 rounded-full border border-cream/10 p-1" role="group" aria-label="Whose pass">
          {[
            [0, `${first} (you)`],
            [1, mateFirst],
          ].map(([i, label]) => (
            <button
              key={i}
              type="button"
              onClick={() => setShown(i)}
              aria-pressed={shown === i}
              className={`min-h-10 truncate rounded-full px-3 text-[0.85rem] transition-colors ${shown === i ? "bg-cream text-ink" : "text-cream/70"}`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="reg-pass-frame">
        <canvas ref={canvasRef} className={`reg-pass ${ready ? "is-ready" : ""}`} aria-label={`ENCLAVE pass for ${pass.name}, ${pass.passId}`} role="img" />
      </div>
      {team ? (
        <p className="-mt-2 font-mono text-[0.78rem] text-cream/50">
          {pass.name} · {pass.passId}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {shareFirst ? (
          <>
            <button type="button" className="cta" onClick={share} disabled={!ready} data-gaze="ignite">
              {forMate ? `Send to ${mateFirst}` : team ? "Save my pass" : "Save pass"}
              <span className="cta-dot" />
            </button>
            <button type="button" className="pill-ghost" onClick={download}>
              Download
            </button>
          </>
        ) : (
          <>
            <button type="button" className="cta" onClick={download} disabled={!ready} data-gaze="ignite">
              {forMate ? `Download ${mateFirst}’s pass` : team ? "Download my pass" : "Download pass"}
              <span className="cta-dot" />
            </button>
            {canShare ? (
              <button type="button" className="pill-ghost" onClick={share}>
                {forMate ? `Send to ${mateFirst}` : "Share"}
              </button>
            ) : null}
          </>
        )}
        <button type="button" className="pill-ghost" onClick={onDone}>
          Done
        </button>
      </div>
      <button type="button" onClick={notMe} className="reg-link self-start text-[0.78rem] text-cream/40 underline-offset-4 hover:text-cream hover:underline">
        Not {first}? Register someone else
      </button>
    </div>
  );
}
