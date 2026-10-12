"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useHero } from "@/components/enclave/hero/heroStore";
import { EVENT } from "@/lib/enclave/event";
import { drawPass, passBlob } from "./drawPass";
import { clearPass } from "./passStorage";

/** entry: { entry: "solo" | "team", teamName, passes: [theirs, teammate's], returning } */
export default function EnclavePass({ entry, onDone, onReset }) {
  const team = entry.entry === "team" && entry.passes.length > 1;
  const me = entry.passes[0];
  const mate = team ? entry.passes[1] : null;
  const first = me.name.split(" ")[0];
  const mateFirst = mate ? mate.name.split(" ")[0] : "";
  const [shown, setShown] = useState(0);
  useEffect(() => setShown(0), [entry]);
  const pass = useMemo(
    () => ({ ...(entry.passes[shown] || me), teamName: team ? entry.teamName : "" }),
    [entry, shown, me, team],
  );
  const forMate = shown === 1;
  const waUrl = EVENT.whatsappGroupUrl;

  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [touch, setTouch] = useState(false);
  useEffect(() => setTouch(matchMedia("(pointer: coarse)").matches), []);
  const shareFirst = canShare && touch;
  const setHero = useHero((s) => s.set);
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
      if (error?.name !== "AbortError") download();
    }
  };

  const notMe = () => {
    clearPass();
    if (onReset) onReset();
    else setHero({ pass: null, panel: "form" });
  };

  return (
    <div className="reg-pass-view">
      <header className="reg-page-head">
        <p className="en-kicker">{entry.returning ? "Welcome back" : "You’re in"}</p>
        <h2 id="reg-title" className="en-display reg-page-title">
          {first}
        </h2>
        <p className="en-copy reg-page-lead">
          {team
            ? `Team ${entry.teamName} · show the QR at the door`
            : `${me.passId} · show the QR at the door`}
        </p>
      </header>

      {team ? (
        <div className="reg-entry-toggle" role="group" aria-label="Whose pass">
          {[
            [0, `${first}`],
            [1, mateFirst],
          ].map(([i, label]) => (
            <button
              key={i}
              type="button"
              onClick={() => setShown(i)}
              aria-pressed={shown === i}
              className={`reg-entry-btn ${shown === i ? "is-on" : ""}`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="reg-pass-frame">
        <canvas
          ref={canvasRef}
          className={`reg-pass ${ready ? "is-ready" : ""}`}
          aria-label={`ENCLAVE pass for ${pass.name}, ${pass.passId}`}
          role="img"
        />
      </div>

      {team ? (
        <p className="reg-footnote">
          {pass.name} · {pass.passId}
        </p>
      ) : null}

      <div className="reg-pass-actions">
        {shareFirst ? (
          <>
            <button type="button" className="reg-submit" onClick={share} disabled={!ready}>
              {forMate ? `Send to ${mateFirst}` : "Save pass"}
            </button>
            <button type="button" className="reg-pass-secondary" onClick={download}>
              Download
            </button>
          </>
        ) : (
          <>
            <button type="button" className="reg-submit" onClick={download} disabled={!ready}>
              {forMate ? `Download ${mateFirst}’s` : "Download pass"}
            </button>
            {canShare ? (
              <button type="button" className="reg-pass-secondary" onClick={share}>
                {forMate ? `Send to ${mateFirst}` : "Share"}
              </button>
            ) : null}
          </>
        )}
        {waUrl ? (
          <a className="reg-pass-whatsapp" href={waUrl} target="_blank" rel="noreferrer">
            Join WhatsApp group
          </a>
        ) : null}
        <button type="button" className="reg-pass-secondary" onClick={onDone}>
          Done
        </button>
      </div>

      <button type="button" onClick={notMe} className="reg-pass-reset">
        Not {first}? Register someone else
      </button>
    </div>
  );
}
