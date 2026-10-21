"use client";

// Event-day door scanner for organizers (/enclave/checkin). Scan a pass QR (ENCLAVE:ENC-…)
// → row in Supabase `enclave_attendance` (or Sheet / local CSV). Search covers lost passes;
// "No pass" covers walk-ins. Every call carries the organizer PIN (CHECKIN_PIN).
import { useCallback, useEffect, useRef, useState } from "react";
import { YEARS } from "@/lib/enclave/event";

const PIN_KEY = "enclave-checkin-pin";
const RECENT_KEY = "enclave-checkin-recent";
const PASS = /ENC-[23456789A-HJ-NP-Z]{5}/;
const SAME_CODE_MS = 4000; // the same QR held in front of the camera counts once
// Each camera frame is searched whole (a pass can be anywhere in the picture, at any distance),
// at sizes that take turns frame by frame: large finds a pass held far away (small in the
// picture), small reads a blurry or glaring one held too close (shrinking sharpens it).
const SCAN_SIZES = [960, 640, 400];
const SCANS_PER_SECOND = 12;
const STUCK_MS = 7000; // nothing read for this long: show tips
const coarse = () => matchMedia("(pointer: coarse)").matches;

const STATUS = {
  checked_in: { title: "Checked in", tone: "ok" },
  already: { title: "Already checked in", tone: "warn" },
  unknown: { title: "Not registered", tone: "bad" },
  notpass: { title: "Not an ENCLAVE pass", tone: "bad" },
  error: { title: "Didn’t go through", tone: "idle" },
};
const TONE_BG = { ok: "bg-[#15803d]", warn: "bg-[#b45309]", bad: "bg-[#b91c1c]", idle: "bg-[#3f3a36]" };

const store = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      /* private mode: works for this visit */
    }
  },
};

const todayIst = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
/** "2026-10-16 09:42:13" -> "09:42" today, else "09:42 · 2026-10-15" */
function clock(at) {
  const [day, time] = String(at || "").split(" ");
  if (!time) return at || "";
  return day === todayIst() ? time.slice(0, 5) : `${time.slice(0, 5)} · ${day}`;
}

const details = (p) => [p?.dept, p?.year, p?.section && `Sec ${p.section}`].filter(Boolean).join(" · ");
/** "Teammate Priya: in at 09:42" / "Teammate Priya: not here yet" */
const mateLine = (team) =>
  team?.mate ? `Teammate ${team.mate.name}: ${team.mate.at ? `in at ${clock(team.mate.at)}` : "not here yet"}` : "";

// short tones: one high = in, two mid = already, one low buzz = refused
let audio = null;
function unlockAudio() {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
  } catch {
    audio = null;
  }
}
function feedback(tone) {
  navigator.vibrate?.(tone === "ok" ? 60 : tone === "warn" ? [70, 60, 70] : [220]);
  if (!audio) return;
  const tones = tone === "ok" ? [[880, 0, 0.13]] : tone === "warn" ? [[540, 0, 0.12], [540, 0.18, 0.12]] : [[180, 0, 0.32]];
  for (const [freq, at, len] of tones) {
    const t = audio.currentTime + at;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = tone === "bad" ? "square" : "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.22, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + len);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + len + 0.02);
  }
}

const EMPTY_WALKIN = { name: "", rrn: "", dept: "", section: "", year: "", phone: "", team_name: "" };

export default function CheckIn({ eventName }) {
  const [ready, setReady] = useState(false); // PIN read from this device
  const [unlocked, setUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [stats, setStats] = useState(null);
  const [tab, setTab] = useState("scan");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [recent, setRecent] = useState([]);
  const pin = useRef("");

  // ---- server
  const lock = useCallback((message = "") => {
    pin.current = "";
    store.set(PIN_KEY, null);
    setUnlocked(false);
    setPinError(message);
  }, []);

  const api = useCallback(
    async (action, payload = {}, usePin = pin.current) => {
      let res;
      try {
        res = await fetch("/enclave/api/checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-checkin-pin": usePin },
          body: JSON.stringify({ action, ...payload }),
          cache: "no-store",
          signal: AbortSignal.timeout?.(25000),
        });
      } catch {
        return { ok: false, error: "No connection. Check the internet and try again." };
      }
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 && usePin === pin.current && pin.current) lock("The PIN was changed. Enter the new one.");
      if (!res.ok) return { ok: false, status: res.status, error: data.error || "Something went wrong. Try again." };
      if (data.registered != null) setStats({ registered: data.registered, checkedIn: data.checkedIn });
      return data;
    },
    [lock]
  );

  useEffect(() => {
    const saved = store.get(PIN_KEY) || "";
    try {
      setRecent(JSON.parse(store.get(RECENT_KEY) || "[]"));
    } catch {
      setRecent([]);
    }
    if (!saved) return setReady(true);
    api("stats", {}, saved).then((data) => {
      if (data.ok) {
        pin.current = saved;
        setUnlocked(true);
      } else if (data.status === 401) {
        store.set(PIN_KEY, null);
        setPinError("The PIN was changed. Enter the new one.");
      } else {
        // offline, sheet slow, or briefly rate-limited on load: trust the saved PIN; calls will
        // say if it's wrong
        pin.current = saved;
        setUnlocked(true);
      }
      setReady(true);
    });
  }, [api]);

  const unlock = async (e) => {
    e.preventDefault();
    const value = pinInput.trim();
    if (!value) return;
    setBusy(true);
    const data = await api("stats", {}, value);
    setBusy(false);
    if (!data.ok) return setPinError(data.error);
    pin.current = value;
    store.set(PIN_KEY, value);
    setPinInput("");
    setPinError("");
    setUnlocked(true);
  };

  // ---- results
  const hold = useRef(false); // a result is on screen: the camera ignores codes
  const timer = useRef(0);
  const lastRead = useRef(0); // when the camera last read a QR (for the "not reading?" tips)
  const dismiss = useCallback(() => {
    clearTimeout(timer.current);
    setResult(null);
    hold.current = false;
    lastRead.current = Date.now();
  }, []);

  /** Add a check-in to "Recent on this phone". */
  const remember = useCallback((data) => {
    if (!data.person || (data.status !== "checked_in" && data.status !== "already")) return;
    setRecent((list) => {
      const item = { status: data.status, name: data.person.name, team: data.person.team || "", passId: data.person.passId, at: data.at };
      const next = [item, ...list].slice(0, 10);
      store.set(RECENT_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const show = useCallback(
    (data) => {
      const status = STATUS[data.status] ? data.status : "error";
      const tone = STATUS[status].tone;
      hold.current = true;
      setResult({ ...data, status });
      feedback(tone);
      remember({ ...data, status });
      clearTimeout(timer.current);
      // a clean check-in clears itself so the line keeps moving (a little longer when there is a
      // teammate line to read); anything else waits for a tap
      if (tone === "ok") timer.current = setTimeout(dismiss, data.team?.mate ? 3200 : 2200);
    },
    [dismiss, remember]
  );

  const checkPass = useCallback(
    async (passId) => {
      setBusy(true);
      const data = await api("checkin", { passId });
      setBusy(false);
      show(data.ok ? data : { status: "error", error: data.error, retry: passId });
    },
    [api, show]
  );

  // ---- camera
  const videoRef = useRef(null);
  const stream = useRef(null);
  const engine = useRef(null); // qr-scanner's decoder: the browser's own where it has one, else its worker
  const wake = useRef(null);
  const last = useRef({ code: "", t: 0 });
  const resume = useRef(false);
  // bumped by every stop: a start still waiting on the permission prompt then knows to give up
  const camRun = useRef(0);
  const [camera, setCamera] = useState("off"); // off | starting | on | error
  const [camError, setCamError] = useState("");
  const [torch, setTorch] = useState({ has: false, on: false });
  const [mirror, setMirror] = useState(false);
  const [stuck, setStuck] = useState(false);

  const onCode = useRef(() => {});
  onCode.current = (text) => {
    lastRead.current = Date.now();
    if (hold.current || busy) return;
    const passId = (String(text).toUpperCase().match(PASS) || [])[0] || "";
    const key = passId || String(text);
    const now = Date.now();
    if (last.current.code === key && now - last.current.t < SAME_CODE_MS) return;
    last.current = { code: key, t: now };
    if (!passId) return show({ status: "notpass" });
    checkPass(passId);
  };

  const keepAwake = async () => {
    try {
      wake.current = await navigator.wakeLock?.request("screen");
    } catch {
      wake.current = null;
    }
  };

  /** Decode frames until the camera stops, SCANS_PER_SECOND at most, cycling SCAN_SIZES. */
  const scanLoop = (QrScanner, video, own) => {
    const canvases = SCAN_SIZES.map(() => document.createElement("canvas"));
    let turn = 0;
    let lastAt = 0;
    const live = () => stream.current === own;
    const next = () => {
      if (!live()) return;
      if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(tick);
      else requestAnimationFrame(tick);
    };
    const tick = async () => {
      const wait = 1000 / SCANS_PER_SECOND - (performance.now() - lastAt);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      lastAt = performance.now();
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (live() && w && h && video.readyState > 1 && !hold.current) {
        const i = turn++ % SCAN_SIZES.length;
        const k = Math.min(1, SCAN_SIZES[i] / Math.max(w, h));
        try {
          const found = await QrScanner.scanImage(video, {
            scanRegion: { x: 0, y: 0, width: w, height: h, downScaledWidth: Math.round(w * k), downScaledHeight: Math.round(h * k) },
            qrEngine: engine.current,
            canvas: canvases[i],
            returnDetailedScanResult: true,
          });
          if (live()) onCode.current(found.data);
        } catch {
          /* no QR in this frame */
        }
      }
      next();
    };
    next();
  };

  const stopCamera = useCallback(() => {
    camRun.current++;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    wake.current?.release?.().catch(() => {});
    wake.current = null;
    setCamera("off");
    setStuck(false);
    setTorch({ has: false, on: false });
  }, []);

  const startCamera = async () => {
    unlockAudio();
    setCamError("");
    setCamera("starting");
    const run = camRun.current;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error(window.isSecureContext ? "nocamera" : "insecure");
      const { default: QrScanner } = await import("qr-scanner");
      engine.current ||= await QrScanner.createQrEngine();
      // "ideal" never fails: the back camera on phones, whatever there is on laptops
      const own = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      // stopped meanwhile (other tab, locked, app switched): don't light the camera after all
      if (run !== camRun.current) {
        own.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = own;
      const video = videoRef.current;
      video.srcObject = own;
      await video.play();
      if (run !== camRun.current) return; // stopCamera already let `own` go
      const track = own.getVideoTracks()[0];
      const facing = track.getSettings?.().facingMode;
      // a selfie / laptop camera reads more naturally mirrored (only the picture; frames aren't)
      setMirror(facing === "user" || (!facing && !coarse()));
      setTorch({ has: !!track.getCapabilities?.().torch, on: false });
      setCamera("on");
      setStuck(false);
      lastRead.current = Date.now();
      keepAwake();
      scanLoop(QrScanner, video, own);
    } catch (err) {
      if (run !== camRun.current) return; // stopped meanwhile: nothing to report
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
      setCamera("error");
      const text = `${err?.name || ""} ${err?.message || err}`;
      setCamError(
        /NotAllowed|Permission|Security/i.test(text)
          ? "Camera access was refused. Allow the camera for this site in the browser settings, then tap Start again."
          : /insecure/.test(text)
            ? "The camera only works on the site’s https:// address."
            : /NotReadable|TrackStart|AbortError/i.test(text)
              ? "The camera is busy in another app or tab. Close it there, then tap Start again."
              : "Couldn’t open a camera on this device. Use Search instead."
      );
    }
  };
  const startRef = useRef(startCamera);
  startRef.current = startCamera;

  const toggleTorch = async () => {
    const track = stream.current?.getVideoTracks()[0];
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch.on }] });
      setTorch({ has: true, on: !torch.on });
    } catch {
      setTorch({ has: false, on: false }); // not supported after all
    }
  };

  // leaving the Scan tab (or locking) turns the camera off; the screen lock comes back with it
  useEffect(() => {
    if (tab !== "scan" || !unlocked) stopCamera();
  }, [tab, unlocked, stopCamera]);
  // switching apps: let the camera go, and pick it up again on return
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && stream.current) {
        stopCamera();
        resume.current = true;
      } else if (document.visibilityState === "visible" && resume.current) {
        resume.current = false;
        startRef.current();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [stopCamera]);
  // nothing read for a while: tips (and the reminder that Search works too)
  useEffect(() => {
    if (camera !== "on") return;
    const id = setInterval(() => setStuck(!hold.current && Date.now() - lastRead.current > STUCK_MS), 1000);
    return () => clearInterval(id);
  }, [camera]);
  useEffect(
    () => () => {
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
      if (engine.current instanceof Worker) engine.current.terminate();
      engine.current = null;
      clearTimeout(timer.current);
    },
    []
  );

  // ---- search
  const [query, setQuery] = useState("");
  const [found, setFound] = useState(null);
  const search = async (e) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    unlockAudio();
    setBusy(true);
    const data = await api("lookup", { query: q });
    setBusy(false);
    setFound(data.ok ? data : { error: data.error });
  };
  const checkFound = async (passId = found.person.passId) => {
    await checkPass(passId);
    setFound(null);
    setQuery("");
  };
  // the person first (quietly), then their teammate, whose result screen then shows both as in
  const checkBoth = async () => {
    setBusy(true);
    const first = await api("checkin", { passId: found.person.passId });
    setBusy(false);
    if (!first.ok) return show({ status: "error", error: first.error, retry: found.person.passId });
    remember(first);
    await checkFound(found.team.mate.passId);
  };

  // ---- without a pass
  const [walkin, setWalkin] = useState(EMPTY_WALKIN);
  const [walkinError, setWalkinError] = useState("");
  const submitWalkin = async (e) => {
    e.preventDefault();
    unlockAudio();
    if (walkin.name.trim().length < 2 || walkin.rrn.trim().length < 4) return setWalkinError("Add at least their name and RRN.");
    setWalkinError("");
    setBusy(true);
    const data = await api("walkin", { person: walkin });
    setBusy(false);
    if (!data.ok) return setWalkinError(data.error);
    show(data);
    setWalkin(EMPTY_WALKIN);
  };
  const noPassFor = (rrn) => {
    setWalkin({ ...EMPTY_WALKIN, rrn: /^ENC-/i.test(rrn) ? "" : rrn.toUpperCase() });
    setFound(null);
    setTab("walkin");
  };

  // ---- screens
  if (!ready) return <main className="min-h-svh bg-ink" />;

  if (!unlocked) {
    return (
      <main className="flex min-h-svh flex-col justify-center bg-ink px-5 py-12 text-cream">
        <form onSubmit={unlock} className="mx-auto w-full max-w-sm">
          <p className="mono-label text-ember">{eventName} · Organizers</p>
          <h1 className="mt-4 font-display text-[3.2rem] uppercase leading-[0.88]">Check-in</h1>
          <p className="mt-3 text-[0.9rem] leading-[1.6] text-cream/60">
            Enter the organizer PIN. This phone remembers it until you lock it.
          </p>
          <label className="reg-field mt-8">
            <span className="mono-label text-cream/55">PIN</span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              aria-invalid={!!pinError}
              autoFocus
            />
          </label>
          {pinError ? (
            <p className="reg-error mt-2" role="alert">
              {pinError}
            </p>
          ) : null}
          <button type="submit" className="cta mt-6 w-full justify-center" disabled={busy}>
            {busy ? "Checking…" : "Unlock"}
            <span className="cta-dot" />
          </button>
        </form>
      </main>
    );
  }

  const r = result && STATUS[result.status];
  return (
    <main className="min-h-svh bg-ink pb-16 text-cream">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-cream/10 bg-ink/95 px-4 py-3 backdrop-blur">
        <p className="mono-label text-ember">{eventName} · Check-in</p>
        <p className="font-mono text-[0.9rem] tabular-nums" aria-live="polite">
          {stats ? (
            <>
              <span className="text-cream">{stats.checkedIn}</span>
              <span className="text-cream/45"> / {stats.registered} in</span>
            </>
          ) : (
            <span className="text-cream/45">–</span>
          )}
        </p>
        <button type="button" className="pill-ghost px-3! py-1.5! text-[0.75rem]" onClick={() => lock()}>
          Lock
        </button>
      </header>

      <nav className="mx-4 mt-4 grid grid-cols-3 gap-1 rounded-full border border-cream/10 p-1" aria-label="Check-in mode">
        {[
          ["scan", "Scan"],
          ["search", "Search"],
          ["walkin", "No pass"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            className={`min-h-11 rounded-full text-[0.85rem] transition-colors ${tab === key ? "bg-cream text-ink" : "text-cream/70"}`}
          >
            {label}
          </button>
        ))}
      </nav>

      <section className={tab === "scan" ? "px-4 pt-4" : "hidden"}>
        <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-2xl bg-black">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            style={mirror ? { transform: "scaleX(-1)" } : undefined}
            muted
            playsInline
          />
          {camera === "on" ? (
            // aiming guide only: the whole picture is searched
            <div className="pointer-events-none absolute inset-[18%]" aria-hidden="true">
              <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-xl border-l-[3px] border-t-[3px] border-cream/85" />
              <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-xl border-r-[3px] border-t-[3px] border-cream/85" />
              <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-xl border-b-[3px] border-l-[3px] border-cream/85" />
              <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-xl border-b-[3px] border-r-[3px] border-cream/85" />
            </div>
          ) : null}
          {camera !== "on" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
              <button type="button" className="cta" onClick={startCamera} disabled={camera === "starting"}>
                {camera === "starting" ? "Opening camera…" : "Start scanning"}
                <span className="cta-dot" />
              </button>
              {camError ? <p className="reg-error max-w-xs">{camError}</p> : null}
            </div>
          ) : null}
          {busy && camera === "on" ? (
            <div className="absolute inset-x-0 bottom-0 bg-black/60 py-2 text-center font-mono text-[0.8rem]">Checking…</div>
          ) : null}
        </div>
        {camera === "on" ? (
          <div className="mx-auto mt-3 flex max-w-md items-center justify-between gap-3">
            <p className="text-[0.82rem] leading-[1.45] text-cream/55">Point at the QR on the pass, about a hand’s length away.</p>
            <div className="flex shrink-0 gap-2">
              {torch.has ? (
                <button type="button" className="pill-ghost" onClick={toggleTorch} aria-pressed={torch.on}>
                  {torch.on ? "Light off" : "Light"}
                </button>
              ) : null}
              <button type="button" className="pill-ghost" onClick={stopCamera}>
                Stop
              </button>
            </div>
          </div>
        ) : null}
        {camera === "on" && stuck ? (
          <div className="mx-auto mt-3 max-w-md rounded-2xl border border-cream/15 p-4 text-[0.84rem] leading-[1.55] text-cream/70" role="status">
            <p className="font-medium text-cream">Not reading?</p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
              <li>Move the pass a little further back, so the camera can focus.</li>
              <li>Tilt their phone to get rid of glare, or ask them to zoom in on the QR.</li>
              <li>
                Or type the pass ID printed on the pass (ENC-…) in{" "}
                <button type="button" className="underline underline-offset-2" onClick={() => setTab("search")}>
                  Search
                </button>
                .
              </li>
            </ul>
          </div>
        ) : null}
      </section>

      <section className={tab === "search" ? "px-4 pt-5" : "hidden"}>
        <form onSubmit={search} className="mx-auto flex max-w-md items-end gap-2">
          <label className="reg-field flex-1">
            <span className="mono-label text-cream/55">Pass ID or RRN</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value.toUpperCase())}
              placeholder="ENC-7Q4KD or RRN"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="search"
            />
          </label>
          <button type="submit" className="cta px-5!" disabled={busy || !query.trim()}>
            Find
          </button>
        </form>
        {found ? (
          <div className="mx-auto mt-5 max-w-md rounded-2xl border border-cream/15 p-5">
            {found.error ? (
              <p className="reg-error">{found.error}</p>
            ) : found.found ? (
              <>
                {found.team ? <p className="mono-label text-ember">Team · {found.team.name}</p> : null}
                <p className={`text-[1.3rem] font-medium ${found.team ? "mt-2" : ""}`}>{found.person.name}</p>
                <p className="mt-1 text-[0.88rem] text-cream/60">{details(found.person)}</p>
                <p className="mt-1 font-mono text-[0.8rem] text-cream/50">
                  {found.person.rrn} · {found.person.passId}
                </p>
                {found.team?.mate ? <p className="mt-3 text-[0.88rem] text-cream/75">{mateLine(found.team)}</p> : null}
                {found.at ? <p className="mt-4 text-[0.9rem] text-[#f59e0b]">Already checked in at {clock(found.at)}.</p> : null}
                <div className="mt-5 flex flex-wrap gap-3">
                  {(() => {
                    const mate = found.team?.mate && !found.team.mate.at ? found.team.mate : null;
                    const mateFirst = mate?.name.split(" ")[0];
                    const me = found.person.name.split(" ")[0];
                    if (!found.at && mate) {
                      // a team at the desk together: both in one tap
                      return (
                        <>
                          <button type="button" className="cta" onClick={checkBoth} disabled={busy}>
                            Check in both
                            <span className="cta-dot" />
                          </button>
                          <button type="button" className="pill-ghost" onClick={() => checkFound()} disabled={busy}>
                            Only {me}
                          </button>
                        </>
                      );
                    }
                    if (!found.at) {
                      return (
                        <button type="button" className="cta" onClick={() => checkFound()} disabled={busy}>
                          Check in
                          <span className="cta-dot" />
                        </button>
                      );
                    }
                    return mate ? (
                      <button type="button" className="cta" onClick={() => checkFound(mate.passId)} disabled={busy}>
                        Check in {mateFirst}
                        <span className="cta-dot" />
                      </button>
                    ) : null;
                  })()}
                </div>
              </>
            ) : (
              <>
                <p className="text-[0.95rem]">No registration for “{query.trim()}”.</p>
                <button type="button" className="pill-ghost mt-4" onClick={() => noPassFor(query.trim())}>
                  Check in without a pass
                </button>
              </>
            )}
          </div>
        ) : null}
      </section>

      <section className={tab === "walkin" ? "px-4 pt-5" : "hidden"}>
        <p className="mx-auto max-w-md text-[0.88rem] leading-[1.6] text-cream/60">
          For people without a pass (registered by Google Form, or walk-ins). They go into the attendance sheet
          with pass ID WALK-IN. If their RRN is registered, their pass is checked in instead. A team: check in each
          person, with the same team name.
        </p>
        <form onSubmit={submitWalkin} className="reg-form mx-auto max-w-md" noValidate>
          {[
            ["name", "Full name", 2, { autoCapitalize: "words" }],
            ["rrn", "RRN", 2, { autoCapitalize: "characters" }],
            ["dept", "Department", 1, { autoCapitalize: "characters" }],
            ["section", "Section", 1, { autoCapitalize: "characters" }],
          ].map(([key, label, span, extra]) => (
            <label key={key} className={`reg-field ${span === 2 ? "col-span-2" : ""}`}>
              <span className="mono-label text-cream/55">{label}</span>
              <input
                value={walkin[key]}
                onChange={(e) => setWalkin({ ...walkin, [key]: key === "name" ? e.target.value : e.target.value.toUpperCase() })}
                autoCorrect="off"
                spellCheck={false}
                {...extra}
              />
            </label>
          ))}
          <label className="reg-field">
            <span className="mono-label text-cream/55">Year</span>
            <select value={walkin.year} onChange={(e) => setWalkin({ ...walkin, year: e.target.value })}>
              <option value="">–</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label className="reg-field">
            <span className="mono-label text-cream/55">Phone</span>
            <input type="tel" inputMode="tel" value={walkin.phone} onChange={(e) => setWalkin({ ...walkin, phone: e.target.value })} />
          </label>
          <label className="reg-field col-span-2">
            <span className="mono-label text-cream/55">Team name (if they’re a team)</span>
            <input
              value={walkin.team_name}
              onChange={(e) => setWalkin({ ...walkin, team_name: e.target.value })}
              placeholder="Leave empty for solo"
              autoCapitalize="words"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>
          {walkinError ? <p className="reg-error col-span-2">{walkinError}</p> : null}
          <button type="submit" className="cta col-span-2 mt-2 justify-center" disabled={busy}>
            {busy ? "Saving…" : "Check in"}
            <span className="cta-dot" />
          </button>
        </form>
      </section>

      {recent.length ? (
        <section className="mx-auto mt-8 max-w-md px-4">
          <p className="mono-label text-cream/45">Recent on this phone</p>
          <ul className="mt-3 divide-y divide-cream/10">
            {recent.map((item, i) => (
              <li key={`${item.passId}-${i}`} className="flex items-center justify-between gap-3 py-2.5 text-[0.88rem]">
                <span className="min-w-0 truncate">
                  {item.name}
                  {item.team ? <span className="text-cream/45"> · {item.team}</span> : null}
                </span>
                <span className={`shrink-0 font-mono text-[0.75rem] ${item.status === "checked_in" ? "text-[#4ade80]" : "text-[#f59e0b]"}`}>
                  {item.status === "checked_in" ? "IN" : "AGAIN"} {clock(item.at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {result ? (
        <div
          className={`fixed inset-0 z-50 flex flex-col justify-center px-6 text-white ${TONE_BG[r.tone]}`}
          role="alertdialog"
          aria-live="assertive"
          aria-label={r.title}
          onClick={r.tone === "ok" ? dismiss : undefined}
        >
          <p className="font-display text-[clamp(3rem,14vw,5.5rem)] uppercase leading-[0.86]">{r.title}</p>
          {result.person ? (
            <div className="mt-6">
              {result.person.team ? (
                <p className="font-mono text-[0.8rem] uppercase tracking-[0.18em] text-white/75">Team · {result.person.team}</p>
              ) : null}
              <p className={`text-[1.6rem] font-medium leading-tight ${result.person.team ? "mt-1" : ""}`}>{result.person.name}</p>
              <p className="mt-1 text-[1rem] text-white/80">{details(result.person)}</p>
              <p className="mt-1 font-mono text-[0.85rem] text-white/70">
                {result.person.rrn} · {result.person.passId}
              </p>
              {result.team?.mate ? <p className="mt-3 text-[1rem] font-medium text-white/90">{mateLine(result.team)}</p> : null}
            </div>
          ) : null}
          <p className="mt-5 text-[1rem] text-white/90">
            {result.status === "checked_in" && `At ${clock(result.at)}.`}
            {result.status === "already" && `First checked in at ${clock(result.at)}. Don’t let the pass in twice.`}
            {result.status === "unknown" && "This pass isn’t in the registrations. Search their RRN, or check them in without a pass."}
            {result.status === "notpass" && "That QR isn’t an ENCLAVE pass."}
            {result.status === "error" && (result.error || "Try again.")}
          </p>
          {r.tone !== "ok" ? (
            <div className="mt-8 flex flex-wrap gap-3">
              {result.status === "error" && result.retry ? (
                <button type="button" className="rounded-full bg-white px-6 py-3 font-medium text-ink" onClick={() => checkPass(result.retry)} disabled={busy}>
                  {busy ? "Trying…" : "Retry"}
                </button>
              ) : null}
              <button type="button" className="rounded-full border border-white/60 px-6 py-3 font-medium" onClick={dismiss}>
                Next
              </button>
            </div>
          ) : (
            <p className="mt-8 font-mono text-[0.75rem] uppercase tracking-[0.18em] text-white/60">Tap or wait for the next scan</p>
          )}
        </div>
      ) : null}
    </main>
  );
}
