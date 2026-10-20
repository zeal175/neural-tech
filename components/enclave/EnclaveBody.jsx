"use client";

import { EVENT } from "@/lib/enclave/event";
import RevealCell from "./RevealCell";
import SampleVideo from "./SampleVideo";

const BLOCKS = [
  {
    label: "Look",
    copy: "Is the path ahead, left or right open? Have you reached the exit?",
    flow: "down",
  },
  {
    label: "Move",
    copy: "Move forward, turn left, turn right.",
    flow: "right",
  },
  {
    label: "Repeat",
    copy: "A set number of times, or until something is true.",
    flow: "left",
  },
  {
    label: "Decide",
    copy: "If this, then that. Otherwise, something else.",
    flow: "right",
  },
];

const ROUNDS = [
  {
    n: "01",
    title: "Code Scramble",
    copy: "The instructions arrive mixed up. Put them back in order and get the rat to the cheese.",
  },
  {
    n: "02",
    title: "Debug the Bomb",
    copy: "The program is almost right, but something is broken, and the clock is running. Find the bug and fix it.",
  },
  {
    n: "03",
    title: "The Maze",
    copy: "No hints and no starting blocks. Build your own way out, and make it as efficient as you can.",
    note: "No hints · no blocks",
  },
];

const FACTS = [
  ["Date", EVENT.dateLong],
  ["Venue", EVENT.venueLabel],
  ["Teams", EVENT.format],
  ["Seats", EVENT.seats],
  ["Fee", EVENT.fee],
  ["Prize", EVENT.prize],
];

const TEAM_LINE = EVENT.formatNote || "Register individually — teams are formed on the day.";

export default function EnclaveBody() {
  return (
    <>
      <div className="en-page">
        <section className="en-pair" aria-label="The experiment">
          <RevealCell dir="down" delay={0} className="en-cell">
            <p className="en-kicker">The experiment</p>
            <h2 className="en-display">You’ve been selected.</h2>
            <p className="en-copy">
              Inside the Enclave there is a maze, a rat, and instructions in plain English. The rat
              can’t think for itself. You can. Tell it what to do, step by step, and get it out.
            </p>
          </RevealCell>

          <RevealCell dir="right" delay={160} className="en-cell">
            <p className="en-kicker">How it works</p>
            <h2 className="en-display">Ten blocks. Plain English.</h2>
            <p className="en-copy">
              No typing. No syntax. Drag blocks into place. Ten blocks in the whole language. Press
              Run — if the rat gets lost, the mistake is in your thinking.
            </p>
          </RevealCell>
        </section>

        <section className="en-logic" aria-label="The blocks">
          {BLOCKS.map((item, i) => (
            <RevealCell
              key={item.label}
              dir={item.flow === "down" ? "down" : item.flow === "left" ? "left" : "right"}
              delay={i * 140}
              className={`en-logic-cell en-logic-${item.label.toLowerCase()}`}
            >
              <span className="en-flow" aria-hidden="true">
                {item.flow === "down" ? "↓" : item.flow === "left" ? "←" : "→"}
              </span>
              <p className="en-logic-label">{item.label}</p>
              <p className="en-copy">{item.copy}</p>
            </RevealCell>
          ))}
        </section>

        <section className="en-sample" aria-label="Sample program">
          <RevealCell dir="down" delay={0} className="en-sample-head">
            <p className="en-kicker">Example</p>
            <h2 className="en-display">A program looks like this.</h2>
            <p className="en-copy">
              Put the blocks together and it reads like a sentence. You press Run, the rat follows
              your instructions, and you watch where it goes.
            </p>
          </RevealCell>

          <RevealCell dir="down" delay={180} className="en-sample-media">
            <div className="en-sample-slot">
              <SampleVideo className="en-sample-video" src="/enclave/videos/sample-program.mp4" />
            </div>
          </RevealCell>
        </section>

        <section className="en-event">
          <RevealCell dir="down" delay={0} className="en-event-head">
            <p className="en-kicker">The event</p>
            <h2 className="en-display">Three rounds. Same rat.</h2>
          </RevealCell>

          <div className="en-rounds">
            {ROUNDS.map((round, i) => (
              <RevealCell
                key={round.n}
                dir={i === 1 ? "right" : "down"}
                delay={i * 160}
                className={`en-round en-round-${i + 1}`}
              >
                <span className="en-round-n">{round.n}</span>
                <h3 className="en-subhead">{round.title}</h3>
                <p className="en-copy">{round.copy}</p>
                {round.note ? <p className="en-ghost">{round.note}</p> : null}
              </RevealCell>
            ))}
          </div>
        </section>

        <section className="en-credits">
          <RevealCell dir="left" delay={0} className="en-credits-mark" aria-hidden="true">
            100
          </RevealCell>
          <RevealCell dir="right" delay={180} className="en-credits-copy">
            <p className="en-kicker">Credits</p>
            <h2 className="en-display">Score and money.</h2>
            <p className="en-copy">
              Every team starts with 100 credits. Earn them by solving well and solving fast. Spend
              them — or use them against someone else. Every choice shows on the big screen.
            </p>
          </RevealCell>
        </section>

        <section className="en-facts-band" aria-label="Event details">
          <RevealCell dir="down" delay={0} className="en-facts">
            {FACTS.map(([label, value]) => (
              <div key={label} className="en-fact">
                <p className="en-kicker">{label}</p>
                <p className="en-fact-val">{value}</p>
                {label === "Teams" ? <p className="en-fact-note">{TEAM_LINE}</p> : null}
              </div>
            ))}
          </RevealCell>
        </section>
      </div>

      <RevealCell dir="flood" delay={0} as="section" className="en-exit">
        <div className="en-exit-inner">
          <h2 className="en-exit-mark">Exit</h2>
          <p className="en-exit-line">
            By the end, you’ll have built a program from nothing.
          </p>
          <div className="en-exit-actions">
            <a href={EVENT.registerUrl} className="en-exit-cta">
              Register →
            </a>
          </div>
          <p className="en-exit-note">
            {EVENT.club} · solo or duo · register alone · teamed on the day
          </p>
        </div>
      </RevealCell>
    </>
  );
}
