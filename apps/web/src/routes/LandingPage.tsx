import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import {
  ArrowRight, BookOpen, Check, ClipboardList, CloudOff, FileText, Folder, GitMerge, GraduationCap, HardDrive, ListChecks,
  Lock, MonitorSmartphone, NotebookPen, RefreshCw, Users, WifiOff,
} from "lucide-react";
import { useSession } from "../stores/session";

// Public landing page: off-white canvas, white cards, big tight Inter type, blue pills, light motion.

const BLUE = "#1e96eb";

/** Fades/lifts content in once it scrolls into view. */
function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return setOn(true);
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setOn(true), io.disconnect()), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      data-on={on}
      style={{ transitionDelay: `${delay}ms` }}
      className={`group/reveal transition-all duration-[900ms] ease-[cubic-bezier(.2,.7,.2,1)] motion-reduce:transition-none ${on ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"} ${className}`}
    >
      {children}
    </div>
  );
}

/** Types words one after another, like someone writing. */
function Typewriter({ words }: { words: string[] }) {
  const [i, setI] = useState(0);
  const [n, setN] = useState(words[0].length);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    const word = words[i];
    const t = setTimeout(
      () => {
        if (!deleting && n === word.length) return setDeleting(true);
        if (deleting && n === 0) {
          setDeleting(false);
          return setI((i + 1) % words.length);
        }
        setN(n + (deleting ? -1 : 1));
      },
      !deleting && n === word.length ? 1800 : deleting ? 45 : 90,
    );
    return () => clearTimeout(t);
  }, [i, n, deleting, words]);
  return (
    <span style={{ color: BLUE }}>
      {words[i].slice(0, n)}
      <span className="ml-1 inline-block h-[0.82em] w-[0.07em] translate-y-[0.06em] animate-[blink_1s_steps(1)_infinite] rounded-full bg-current align-baseline" />
    </span>
  );
}

/** Hand-drawn underline that draws itself when revealed. */
const Scribble = ({ children }: { children: ReactNode }) => (
  <span className="relative inline-block whitespace-nowrap">
    {children}
    <svg viewBox="0 0 200 20" preserveAspectRatio="none" className="absolute -bottom-[0.18em] left-0 h-[0.32em] w-full overflow-visible" aria-hidden>
      <path
        d="M2 14 C 40 4, 90 4, 120 10 S 180 18, 198 6"
        fill="none"
        stroke={BLUE}
        strokeWidth="5"
        strokeLinecap="round"
        pathLength={1}
        className="[stroke-dasharray:1] [stroke-dashoffset:1] transition-[stroke-dashoffset] delay-300 duration-[1200ms] ease-out group-data-[on=true]/reveal:[stroke-dashoffset:0]"
      />
    </svg>
  </span>
);

const pill = "inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-[17px] font-medium transition";
const bluePill = `${pill} bg-[#1e96eb] text-white shadow-[0_6px_20px_-6px_rgb(30_150_235/0.6)] hover:bg-[#1786d6]`;
const outlinePill = `${pill} border border-[#1e96eb] text-[#1e96eb] hover:bg-[#1e96eb]/5`;
const card = "rounded-[28px] border border-black/[0.05] bg-white";
const eyebrow = "text-[15px] font-semibold tracking-[0.18em] text-[#1e96eb] uppercase";
const h2 = "text-[40px] leading-[1.05] font-semibold tracking-[-0.035em] text-[#121212] md:text-[64px]";

/* ───────── Mock-ups of our own app ───────── */

function Chrome({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden ${card} shadow-[0_40px_80px_-30px_rgb(0_0_0/0.18)] ${className}`}>
      <div className="flex items-center gap-3 border-b border-black/[0.05] px-5 py-3">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
        </span>
        <span className="mx-auto flex items-center gap-1.5 text-[13px] font-medium text-[#121212]">
          <FileText className="size-3.5 text-[#8a8a8a]" /> {title}
        </span>
        <span className="text-[12px] text-[#8a8a8a]">Share</span>
      </div>
      {children}
    </div>
  );
}

const Cursor = ({ name, color, className = "" }: { name: string; color: string; className?: string }) => (
  <span className={`pointer-events-none absolute z-10 flex items-start ${className}`}>
    <svg width="14" height="16" viewBox="0 0 14 16" fill={color} aria-hidden>
      <path d="M0 0l14 7-6 2-3 7z" />
    </svg>
    <span className="mt-3 -ml-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-white" style={{ backgroundColor: color }}>
      {name}
    </span>
  </span>
);

function HeroApp() {
  return (
    <Chrome title="Group report">
      <div className="flex h-[380px] text-left md:h-[560px]">
        <aside className="hidden w-60 shrink-0 flex-col gap-1 border-r border-black/[0.05] bg-[#f7f7f7] p-4 text-[13px] md:flex">
          <p className="mb-4 flex items-center gap-2 font-semibold">
            <span className="flex size-6 items-center justify-center rounded-md bg-[#1e96eb] text-[11px] text-white">G</span> Group project
          </p>
          {["All docs", "Recent"].map((t) => (
            <span key={t} className="rounded-md px-2 py-1.5 text-[#5c5c5c]">{t}</span>
          ))}
          <p className="mt-4 mb-1 px-2 text-[11px] text-[#8a8a8a]">Organize</p>
          <span className="flex items-center gap-2 px-2 py-1.5"><Folder className="size-3.5 text-[#8a8a8a]" /> Research</span>
          {["Interview notes", "Group report", "Sources"].map((t, i) => (
            <span key={t} className={`ml-4 flex items-center gap-2 rounded-md px-2 py-1.5 ${i === 1 ? "bg-black/[0.06] font-medium" : ""}`}>
              <FileText className="size-3.5 text-[#8a8a8a]" /> {t}
            </span>
          ))}
        </aside>
        <div className="relative flex-1 px-8 py-10 md:px-20 md:py-16">
          <Cursor name="Ali" color="#7c5cfa" className="top-[46%] left-[58%] animate-[drift_7s_ease-in-out_infinite]" />
          <Cursor name="Priya" color="#ff4d8d" className="top-[70%] left-[24%] animate-[drift_9s_ease-in-out_infinite_reverse]" />
          <div className="flex items-start justify-between">
            <p className="text-[30px] font-bold tracking-[-0.02em] md:text-[40px]">Group report</p>
            <span className="mt-2 flex items-center gap-1 rounded-full bg-[#e9f8ef] px-2.5 py-1 text-[12px] font-medium text-[#1f9254]">
              <Check className="size-3" /> Synced
            </span>
          </div>
          <p className="mt-1 mb-8 text-[13px] text-[#8a8a8a]">Research · edited just now</p>
          <p className="mb-3 text-[17px] font-semibold">Introduction</p>
          <p className="text-[15px] leading-8 text-[#3a3a3a]">
            Most collaborative editors stop saving the moment the connection drops.{" "}
            <mark className="rounded bg-[#ffe1ec] px-0.5 text-inherit">We studied how local-first apps avoid this</mark> by keeping
            every change on the device and <mark className="rounded bg-[#ebe5ff] px-0.5 text-inherit">merging edits when people reconnect.</mark>
          </p>
          <div className="mt-8 flex flex-col gap-3">
            {["96%", "88%", "92%", "60%"].map((w) => (
              <div key={w} className="h-2.5 rounded-full bg-black/[0.06]" style={{ width: w }} />
            ))}
          </div>
        </div>
      </div>
    </Chrome>
  );
}

function WriteVisual() {
  return (
    <Chrome title="Lecture 4 · Databases">
      <div className="grid min-h-[380px] grid-cols-2 divide-x divide-black/[0.05] text-left">
        <pre className="p-6 font-mono text-[13px] leading-7 text-[#5c5c5c]">{`# Lecture 4\n\n## Normal forms\n- [x] 1NF\n- [x] 2NF\n- [ ] 3NF\n\n> Ask about BCNF\n\n| Key | Type |\n|-----|------|\n| id  | PK   |`}</pre>
        <div className="p-6 text-[14px] leading-7">
          <p className="mb-2 text-[22px] font-bold tracking-tight">Lecture 4</p>
          <p className="mb-1 font-semibold">Normal forms</p>
          <p>☑ 1NF</p>
          <p>☑ 2NF</p>
          <p>☐ 3NF</p>
          <p className="my-3 border-l-[3px] border-[#1e96eb] pl-3 text-[#5c5c5c]">Ask about BCNF</p>
          <div className="grid w-40 grid-cols-2 overflow-hidden rounded-lg border border-black/10 text-[12px]">
            <span className="bg-[#f7f7f7] px-2 py-1 font-semibold">Key</span>
            <span className="bg-[#f7f7f7] px-2 py-1 font-semibold">Type</span>
            <span className="px-2 py-1">id</span>
            <span className="px-2 py-1">PK</span>
          </div>
        </div>
      </div>
    </Chrome>
  );
}

function OfflineVisual() {
  const rows = [
    { icon: WifiOff, text: "Offline — 3 changes saved on this device", cls: "bg-[#fff6e8] text-[#a2620a]" },
    { icon: RefreshCw, text: "Connection back — syncing…", cls: "bg-[#e9f4fe] text-[#1373b8]" },
    { icon: Check, text: "All changes synced", cls: "bg-[#e9f8ef] text-[#1f9254]" },
  ];
  return (
    <Chrome title="Field notes · Day 3">
      <div className="flex min-h-[380px] flex-col justify-center gap-4 p-8">
        {rows.map(({ icon: Icon, text, cls }, i) => (
          <div
            key={text}
            className={`flex items-center gap-3 rounded-2xl px-5 py-4 text-[15px] font-medium opacity-0 transition-all duration-700 group-data-[on=true]/reveal:translate-x-0 group-data-[on=true]/reveal:opacity-100 ${cls} -translate-x-6`}
            style={{ transitionDelay: `${300 + i * 350}ms` }}
          >
            <Icon className="size-4" /> {text}
          </div>
        ))}
      </div>
    </Chrome>
  );
}

function MergeVisual() {
  return (
    <Chrome title="Group report">
      <div className="relative flex min-h-[380px] flex-col gap-4 p-8 text-left">
        <div className="grid grid-cols-2 gap-4">
          {[
            ["Priya · on the bus", "#ff4d8d", "Rewrote the introduction"],
            ["Ali · in the library", "#7c5cfa", "Added the conclusion"],
          ].map(([who, color, what]) => (
            <div key={who} className="rounded-2xl border border-black/[0.06] p-4">
              <p className="mb-1 text-[12px] font-semibold" style={{ color }}>{who}</p>
              <p className="text-[14px]">{what}</p>
              <p className="mt-2 flex items-center gap-1 text-[11px] text-[#8a8a8a]"><WifiOff className="size-3" /> offline</p>
            </div>
          ))}
        </div>
        <div className="flex justify-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-[#1e96eb]/10 text-[#1e96eb]">
            <GitMerge className="size-5 rotate-180" />
          </span>
        </div>
        <div className="rounded-2xl bg-[#e9f8ef] p-5">
          <p className="mb-1 text-[12px] font-semibold text-[#1f9254]">Both back online</p>
          <p className="text-[15px]">One document. New introduction <b>and</b> new conclusion. No “which version do you want to keep?”</p>
        </div>
      </div>
    </Chrome>
  );
}

/* ───────── Page ───────── */

const USES = [
  { icon: GraduationCap, label: "Lecture notes" },
  { icon: Users, label: "Group reports" },
  { icon: ClipboardList, label: "Meeting minutes" },
  { icon: BookOpen, label: "Team wiki" },
  { icon: NotebookPen, label: "Research journal" },
  { icon: ListChecks, label: "Study checklist" },
];

const FAQ = [
  ["Do I need internet to use it?", "Only the first time, to set up your account. After that the app lives on your device — write, organise and search with no connection."],
  ["What if we both edit the same part?", "Nothing is thrown away. Every change is kept and all devices end up showing the same text, without a pop-up asking you to choose."],
  ["Where do my documents live?", "On your device first, in the browser's storage. A copy goes to the sync server so your other devices and your teammates receive it."],
  ["Is it free?", "Yes. SyncScribe was built for a university project using only free, open-source tools."],
];

function Feature({ kicker, title, text, visual, flip }: { kicker: ReactNode; title: ReactNode; text: string; visual: ReactNode; flip?: boolean }) {
  return (
    <Reveal className="grid items-center gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
      <div className={flip ? "lg:order-2" : ""}>
        {kicker}
        <h3 className="mt-4 text-[38px] leading-[1.08] font-semibold tracking-[-0.035em] md:text-[54px]">{title}</h3>
        <p className="mt-6 max-w-[460px] text-[19px] leading-relaxed text-[#5c5c5c]">{text}</p>
      </div>
      <div className={flip ? "lg:order-1" : ""}>{visual}</div>
    </Reveal>
  );
}

export default function LandingPage() {
  const signedIn = useSession((s) => s.status === "signedIn");
  const start = signedIn ? "/" : "/signup";
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <div className="min-h-dvh bg-[#f7f7f7] font-sans text-[#121212] antialiased">
      <style>{`
        @keyframes blink { 50% { opacity: 0 } }
        @keyframes marquee { to { transform: translateX(-50%) } }
        @keyframes drift { 0%,100% { transform: translate(0,0) } 33% { transform: translate(28px,-14px) } 66% { transform: translate(-18px,10px) } }
        @keyframes floaty { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
        @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important } }
      `}</style>

      {/* Navigation */}
      <header className={`sticky top-0 z-50 bg-[#f7f7f7]/85 backdrop-blur-md transition-[border-color] ${scrolled ? "border-b border-black/[0.06]" : "border-b border-transparent"}`}>
        <div className="mx-auto flex h-[76px] max-w-[1240px] items-center gap-10 px-6">
          <Link to="/welcome" className="flex items-center gap-2.5 text-[17px] font-semibold tracking-tight">
            <span className="flex size-8 items-center justify-center rounded-[10px] bg-[#121212] text-white">
              <NotebookPen className="size-[18px]" />
            </span>
            SyncScribe
          </Link>
          <nav className="hidden items-center gap-8 text-[16px] lg:flex">
            {[["Features", "#features"], ["Offline", "#offline"], ["Use cases", "#uses"], ["FAQ", "#faq"]].map(([l, h]) => (
              <a key={l} href={h} className="hover:text-[#1e96eb]">{l}</a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {!signedIn && (
              <Link to="/login" className="rounded-full border border-black/15 px-5 py-2 text-[15px] font-medium hover:bg-white">
                Sign in
              </Link>
            )}
            <Link to={start} className="rounded-full bg-[#1e96eb] px-5 py-2 text-[15px] font-medium text-white hover:bg-[#1786d6]">
              {signedIn ? "Open app" : "Get started"}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-[1240px] px-6 pt-20 text-center md:pt-32">
        <Reveal>
          <h1 className="mx-auto max-w-[1100px] text-[52px] leading-[1.02] font-semibold tracking-[-0.045em] md:text-[104px]">
            Write together,
            <br />
            <span className="inline-flex items-center gap-[0.2em]">
              <span className="inline-flex size-[0.78em] -rotate-6 items-center justify-center rounded-[0.18em] bg-[#1e96eb] text-white shadow-[0_8px_24px_-8px_rgb(30_150_235/0.7)]">
                <CloudOff className="size-[0.48em]" strokeWidth={2.5} />
              </span>
              <Typewriter words={["offline.", "anywhere.", "in sync."]} />
            </span>
          </h1>
          <p className="mx-auto mt-8 max-w-[680px] text-[20px] leading-relaxed text-[#3a3a3a] md:text-[24px]">
            A markdown workspace that keeps working without the internet and merges everyone's edits the moment you're back online.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link to={start} className={bluePill}>Get started — free</Link>
            <a href="#features" className={outlinePill}>See how it works</a>
          </div>
        </Reveal>
        <Reveal delay={150} className="mx-auto mt-20 max-w-[1120px] md:mt-24">
          <HeroApp />
        </Reveal>
      </section>

      {/* Bento */}
      <section className="mx-auto mt-32 grid max-w-[1240px] gap-6 px-6 md:mt-40 lg:grid-cols-[1.1fr_1fr]">
        <Reveal className={`${card} flex flex-col justify-between overflow-hidden p-10`}>
          <div className="relative h-[260px]">
            {[
              ["Train", "8%", "8%", "#fff6e8", "#a2620a", WifiOff],
              ["Flight mode", "52%", "4%", "#e9f4fe", "#1373b8", CloudOff],
              ["Library basement", "18%", "48%", "#f3efff", "#6a4ee0", WifiOff],
              ["Back online", "58%", "52%", "#e9f8ef", "#1f9254", RefreshCw],
            ].map(([label, left, top, bg, fg, Icon], i) => {
              const I = Icon as typeof WifiOff;
              return (
                <span
                  key={label as string}
                  className="absolute flex items-center gap-2 rounded-2xl px-5 py-3 text-[16px] font-medium shadow-sm"
                  style={{ left: left as string, top: top as string, background: bg as string, color: fg as string, animation: `floaty ${4 + i}s ease-in-out infinite` }}
                >
                  <I className="size-4" /> {label as string}
                </span>
              );
            })}
          </div>
          <div>
            <h3 className="text-[34px] leading-[1.1] font-semibold tracking-[-0.03em] md:text-[44px]">Bad Wi-Fi is no longer your problem</h3>
            <p className="mt-4 text-[19px] text-[#5c5c5c]">Write on the train, in the air or in the basement. Your notes save instantly and sync later.</p>
          </div>
        </Reveal>
        <div className="grid gap-6">
          <Reveal delay={100} className={`${card} p-10`}>
            <div className="mb-8 flex flex-wrap gap-3">
              {[["Priya", "#ff4d8d"], ["Ali", "#7c5cfa"], ["Sam", "#1e96eb"], ["Mei", "#22b573"]].map(([n, c]) => (
                <span key={n} className="flex items-center gap-2 rounded-full border border-black/[0.06] py-1.5 pr-4 pl-1.5 text-[15px]">
                  <span className="flex size-7 items-center justify-center rounded-full text-[12px] font-semibold text-white" style={{ background: c }}>{n[0]}</span>
                  {n}
                </span>
              ))}
            </div>
            <h3 className="text-[30px] leading-[1.1] font-semibold tracking-[-0.03em]">Four people, one document, zero conflicts</h3>
            <p className="mt-3 text-[18px] text-[#5c5c5c]">Edits merge automatically — live when you're online, later when you're not.</p>
          </Reveal>
          <Reveal delay={200} className={`${card} flex items-center gap-8 p-10`}>
            <div className="flex shrink-0 -space-x-4">
              <span className="flex size-16 items-center justify-center rounded-2xl bg-[#e9f8ef] text-[#1f9254] shadow-sm"><Lock className="size-7" /></span>
              <span className="flex size-16 items-center justify-center rounded-2xl bg-[#e9f4fe] text-[#1373b8] shadow-sm"><HardDrive className="size-7" /></span>
            </div>
            <div>
              <h3 className="text-[28px] leading-[1.1] font-semibold tracking-[-0.03em]">Your device comes first</h3>
              <p className="mt-2 text-[18px] text-[#5c5c5c]">Documents are stored with you, not just in the cloud.</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto mt-40 flex max-w-[1240px] scroll-mt-24 flex-col gap-40 px-6">
        <Feature
          kicker={
            <p className="text-[52px] leading-none font-bold tracking-[-0.04em] italic md:text-[64px]">
              Write<span className="ml-1 inline-block h-[0.8em] w-[4px] translate-y-[0.08em] animate-[blink_1s_steps(1)_infinite] rounded-full bg-[#1e96eb]" />
            </p>
          }
          title="in plain markdown, read it beautifully"
          text="Type headings, lists, tables and checklists in markdown. Flip to preview or work side by side — every keystroke is saved before you finish the sentence."
          visual={<WriteVisual />}
        />
        <div id="offline" className="scroll-mt-24">
          <Feature
            flip
            kicker={<p className={eyebrow}>Offline</p>}
            title={<>Keep working when the <Scribble>signal</Scribble> doesn't</>}
            text="SyncScribe opens and saves without a connection. A small status badge always tells you whether you're offline, syncing or fully synced."
            visual={<OfflineVisual />}
          />
        </div>
        <Feature
          kicker={<p className={eyebrow}>Collaborate</p>}
          title={<>Edit at the same time, <Scribble>never</Scribble> overwrite</>}
          text="See teammates' cursors live. Edit the same document on different devices, even offline. When everyone reconnects, the changes simply fit together."
          visual={<MergeVisual />}
        />
      </section>

      {/* Use cases */}
      <section id="uses" className="mt-44 scroll-mt-24">
        <Reveal className="mx-auto flex max-w-[1240px] flex-wrap items-end justify-between gap-8 px-6">
          <h2 className={`${h2} max-w-[760px]`}>Made for the things students actually write</h2>
          <Link to={start} className={bluePill}>Start a document</Link>
        </Reveal>
        <div className="mt-14 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
          <div className="flex w-max animate-[marquee_40s_linear_infinite] gap-6 px-6 hover:[animation-play-state:paused]">
            {[...USES, ...USES].map(({ icon: Icon, label }, i) => (
              <div key={i} className={`${card} flex h-[220px] w-[300px] shrink-0 flex-col justify-between p-8 transition hover:-translate-y-1 hover:shadow-lg`}>
                <span className="flex size-14 items-center justify-center rounded-2xl bg-[#1e96eb] text-white">
                  <Icon className="size-7" />
                </span>
                <span className="flex items-center justify-between text-[22px] font-medium tracking-tight">
                  {label} <ArrowRight className="size-5 text-[#8a8a8a]" />
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto mt-44 max-w-[1240px] scroll-mt-24 px-6">
        <Reveal className={`${card} grid gap-12 p-10 md:p-16 lg:grid-cols-2`}>
          <div>
            <p className={eyebrow}>Local-first workspace</p>
            <h2 className={`${h2} mt-5`}>Good questions, short answers</h2>
            <p className="mt-6 text-[19px] leading-relaxed text-[#5c5c5c]">
              SyncScribe saves to your device first and syncs in the background. Here's what people usually ask before they start.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group rounded-3xl border border-black/[0.06] p-7 open:bg-[#fafafa]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[20px] font-semibold tracking-tight">
                  {q}
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#f2f2f2] text-[20px] text-[#5c5c5c] transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-4 text-[17px] leading-relaxed text-[#5c5c5c]">{a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Devices */}
      <section className="mx-auto mt-44 max-w-[1240px] px-6">
        <Reveal className="text-center">
          <h2 className={h2}>On your laptop. On your phone.</h2>
          <p className="mt-5 text-[20px] text-[#5c5c5c]">Open it in the browser, or install it like an app — it works offline either way.</p>
        </Reveal>
        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <Reveal className="rounded-[28px] bg-[#ececec] p-10">
            <div className="mb-8 flex items-center justify-between">
              <h3 className="text-[28px] font-semibold tracking-tight">In the browser</h3>
              <Link to={start} className="rounded-full bg-[#1e96eb] px-5 py-2.5 text-[15px] font-medium text-white">Open now</Link>
            </div>
            <div className="h-[260px] overflow-hidden rounded-t-2xl border border-black/[0.06] bg-white p-6 text-left">
              <p className="text-[24px] font-bold tracking-tight">Welcome to SyncScribe</p>
              <p className="mt-4 text-[14px] leading-7 text-[#5c5c5c]">Everything you type is saved on this device instantly. When you're offline, keep working — your changes sync when you reconnect.</p>
              <div className="mt-5 flex flex-col gap-2.5">
                {["90%", "80%", "70%"].map((w) => <div key={w} className="h-2 rounded-full bg-black/[0.06]" style={{ width: w }} />)}
              </div>
            </div>
          </Reveal>
          <Reveal delay={120} className="rounded-[28px] bg-[#ececec] p-10">
            <div className="mb-8 flex items-center justify-between">
              <h3 className="text-[28px] font-semibold tracking-tight">As an app</h3>
              <span className="flex items-center gap-2 rounded-full bg-[#1e96eb] px-5 py-2.5 text-[15px] font-medium text-white"><MonitorSmartphone className="size-4" /> Install</span>
            </div>
            <div className="mx-auto h-[260px] w-[240px] overflow-hidden rounded-t-[36px] border-[7px] border-b-0 border-[#121212] bg-white p-5 text-left">
              <p className="mb-4 text-center text-[12px] font-semibold">9:41</p>
              <p className="mb-3 text-[15px] font-semibold">Recent</p>
              {["Group report", "Lecture 4", "Field notes"].map((t) => (
                <div key={t} className="mb-2 rounded-xl border border-black/[0.06] px-3 py-2.5 text-[13px]">{t}</div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Blue band */}
      <section className="mt-44 bg-[#1e96eb] px-6 py-28 text-center text-white md:py-36">
        <Reveal>
          <h2 className="mx-auto max-w-[900px] text-[44px] leading-[1.02] font-semibold tracking-[-0.04em] md:text-[80px]">Start writing. The Wi-Fi can wait.</h2>
          <p className="mx-auto mt-6 max-w-[560px] text-[20px] text-white/80">Free account, ready in seconds.</p>
          <Link to={start} className={`${pill} mt-10 bg-white text-[#1e96eb] hover:bg-white/90`}>
            Get started <ArrowRight className="size-4" />
          </Link>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="bg-[#f7f7f7]">
        <div className="mx-auto grid max-w-[1240px] gap-10 px-6 py-16 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="flex items-center gap-2.5 text-[17px] font-semibold">
              <span className="flex size-8 items-center justify-center rounded-[10px] bg-[#121212] text-white"><NotebookPen className="size-[18px]" /></span>
              SyncScribe
            </p>
            <p className="mt-4 max-w-[240px] text-[15px] text-[#5c5c5c]">Local-first, collaborative markdown — built for a university project.</p>
          </div>
          {[
            ["Product", [["Features", "#features"], ["Offline", "#offline"], ["Use cases", "#uses"]]],
            ["Account", [["Sign in", "/login"], ["Create account", "/signup"]]],
            ["Help", [["FAQ", "#faq"]]],
          ].map(([title, links]) => (
            <div key={title as string}>
              <p className="mb-4 text-[15px] font-semibold">{title as string}</p>
              <ul className="flex flex-col gap-3 text-[15px] text-[#5c5c5c]">
                {(links as string[][]).map(([l, h]) => (
                  <li key={l}>{h.startsWith("/") ? <Link to={h} className="hover:text-[#1e96eb]">{l}</Link> : <a href={h} className="hover:text-[#1e96eb]">{l}</a>}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="border-t border-black/[0.06] py-6 text-center text-[14px] text-[#8a8a8a]">© {new Date().getFullYear()} SyncScribe · University project</p>
      </footer>
    </div>
  );
}
