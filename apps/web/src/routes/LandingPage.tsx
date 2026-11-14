import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { Link } from "react-router";
import { Check, ChevronRight, HardDrive, RefreshCw, WifiOff } from "lucide-react";
import { useSession } from "../stores/session";

// Public landing page in a clean, product-page style: big type, white space and scroll-driven motion.

const FONT: CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter Variable", "Helvetica Neue", sans-serif',
};
const clamp = (v: number) => Math.min(1, Math.max(0, v));
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * 0 → 1 progress of an element through the viewport.
 * "view": from its top entering the bottom of the screen until its top reaches `endAt` of the screen height.
 * "sticky": across a tall section whose content is pinned (0 at its top, 1 at its bottom).
 */
function useScrollProgress(ref: RefObject<HTMLElement | null>, mode: "view" | "sticky" = "view", endAt = 0.35) {
  const [p, setP] = useState(reducedMotion() ? 1 : 0);
  useEffect(() => {
    if (reducedMotion()) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      setP(mode === "sticky" ? clamp(-r.top / Math.max(1, r.height - vh)) : clamp((vh - r.top) / (vh * (1 - endAt))));
    };
    const onScroll = () => (frame ||= requestAnimationFrame(update));
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ref, mode, endAt]);
  return p;
}

/** Fades and lifts its children in as they scroll into view. */
function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const p = useScrollProgress(ref, "view", 0.75);
  const t = clamp(p * 1.4 - delay);
  return (
    <div ref={ref} className={className} style={{ opacity: t, transform: `translateY(${(1 - t) * 40}px)` }}>
      {children}
    </div>
  );
}

const blueButton = "inline-flex items-center rounded-full bg-[#0071e3] px-6 py-3 text-[17px] font-normal text-white transition hover:bg-[#0077ed]";
const blueLink = "inline-flex items-center text-[17px] text-[#0066cc] hover:underline";

/* ───────────── Product mock-ups (our own app, drawn in HTML) ───────────── */

function Window({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-[22px] border border-black/[0.06] bg-white shadow-[0_30px_80px_-20px_rgb(0_0_0/0.25)] ${className}`}>
      <div className="flex items-center gap-2 border-b border-black/[0.05] bg-[#fbfbfd] px-4 py-3">
        <span className="size-3 rounded-full bg-[#ff5f57]" />
        <span className="size-3 rounded-full bg-[#febc2e]" />
        <span className="size-3 rounded-full bg-[#28c840]" />
      </div>
      {children}
    </div>
  );
}

const Cursor = ({ name, color }: { name: string; color: string }) => (
  <span className="relative mx-0.5 inline-block h-[1.1em] w-[2px] translate-y-[0.15em]" style={{ backgroundColor: color }}>
    <span className="absolute -top-6 left-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-white" style={{ backgroundColor: color }}>
      {name}
    </span>
  </span>
);

function AppMock() {
  return (
    <Window>
      <div className="flex h-[360px] text-left sm:h-[520px]">
        <aside className="hidden w-56 shrink-0 flex-col gap-1 border-r border-black/[0.05] bg-[#f5f5f7] p-4 text-[13px] sm:flex">
          <p className="mb-3 font-semibold">Group project</p>
          {["All docs", "Recent"].map((t) => (
            <span key={t} className="rounded-md px-2 py-1 text-[#6e6e73]">{t}</span>
          ))}
          <p className="mt-4 mb-1 px-2 text-[11px] text-[#86868b]">Organize</p>
          {["Introduction", "Research notes", "Final report"].map((t, i) => (
            <span key={t} className={`rounded-md px-2 py-1 ${i === 2 ? "bg-black/[0.06] font-medium" : "text-[#1d1d1f]"}`}>{t}</span>
          ))}
        </aside>
        <div className="flex-1 px-8 py-10 sm:px-16 sm:py-14">
          <div className="flex items-start justify-between gap-4">
            <p className="text-[28px] font-semibold tracking-tight sm:text-[40px]">Final report</p>
            <span className="mt-2 flex shrink-0 items-center gap-1 rounded-full bg-[#e8f8ee] px-2.5 py-1 text-[12px] font-medium text-[#1d8f4e]">
              <Check className="size-3" /> Synced
            </span>
          </div>
          <p className="mt-1 mb-8 text-[13px] text-[#86868b]">Edited by Priya and Ali · just now</p>
          <p className="text-[15px] leading-8 text-[#1d1d1f] sm:text-[17px]">
            Local-first software keeps working without the internet
            <Cursor name="Priya" color="#ff375f" /> and quietly merges everyone's edits when devices reconnect.
            <Cursor name="Ali" color="#0a84ff" />
          </p>
          <div className="mt-8 flex flex-col gap-3">
            {["94%", "86%", "90%", "52%"].map((w) => (
              <div key={w} className="h-2.5 rounded-full bg-black/[0.06]" style={{ width: w }} />
            ))}
          </div>
        </div>
      </div>
    </Window>
  );
}

/* ───────────── Sections ───────────── */

/** Hero: headline, then the app window tilting up and settling as you scroll. */
function Hero({ cta }: { cta: { to: string; label: string } }) {
  const ref = useRef<HTMLDivElement>(null);
  const p = useScrollProgress(ref, "view", 0.15);
  const t = clamp((p - 0.45) / 0.55); // starts tilted, flattens while scrolling
  return (
    <section className="overflow-hidden px-6 pt-20 pb-10 text-center md:pt-28">
      <p className="text-[21px] font-semibold text-[#1d1d1f] md:text-[24px]">SyncScribe</p>
      <h1 className="mx-auto mt-2 max-w-[980px] text-[48px] leading-[1.05] font-semibold tracking-[-0.025em] md:text-[96px]">
        Write anywhere.
        <br />
        <span className="bg-gradient-to-r from-[#0071e3] via-[#5e5ce6] to-[#bf5af2] bg-clip-text text-transparent">Sync everywhere.</span>
      </h1>
      <p className="mx-auto mt-6 max-w-[640px] text-[21px] leading-snug text-[#6e6e73] md:text-[28px]">
        A markdown workspace that works offline and merges your team's edits on its own.
      </p>
      <div className="mt-9 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
        <Link to={cta.to} className={blueButton}>{cta.label}</Link>
        <a href="#how" className={blueLink}>
          See how it works <ChevronRight className="size-4" />
        </a>
      </div>
      <div ref={ref} className="mx-auto mt-16 max-w-[1100px] [perspective:1600px] md:mt-24">
        <div
          style={{
            transform: `rotateX(${(1 - t) * 22}deg) scale(${0.88 + t * 0.12}) translateY(${(1 - t) * 40}px)`,
            transformOrigin: "center top",
          }}
        >
          <AppMock />
        </div>
      </div>
    </section>
  );
}

/** A large paragraph whose words light up one by one as you scroll. */
function Statement() {
  const ref = useRef<HTMLDivElement>(null);
  const p = useScrollProgress(ref, "view", 0.2);
  const words =
    "Your writing lives on your device first. No spinners. No lost work. No “reconnecting…”. When the Wi-Fi comes back, everything syncs quietly — and every edit from every teammate fits together.".split(
      " ",
    );
  return (
    <section className="px-6 py-32 md:py-48">
      <div ref={ref} className="mx-auto max-w-[980px]">
        <p className="text-[32px] leading-[1.15] font-semibold tracking-[-0.02em] md:text-[56px]">
          {words.map((w, i) => (
            <span key={i} className="transition-colors duration-300" style={{ color: p * 1.25 > i / words.length ? "#1d1d1f" : "#d2d2d7" }}>
              {w}{" "}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}

const STEPS = [
  { title: "Type.", text: "Every keystroke becomes a small change to your document. No Save button." },
  { title: "Saved on your device.", text: "Changes land in your browser's storage instantly — online or not." },
  { title: "Synced and merged.", text: "When you're online, changes flow to your team and fit together with theirs." },
];

function StepVisual({ step }: { step: number }) {
  const panel = (i: number, content: ReactNode) => (
    <div className="absolute inset-0 flex items-center justify-center transition-all duration-700" style={{ opacity: step === i ? 1 : 0, transform: `scale(${step === i ? 1 : 0.94})` }}>
      {content}
    </div>
  );
  return (
    <div className="relative aspect-square w-full max-w-[520px] rounded-[32px] bg-[#f5f5f7]">
      {panel(
        0,
        <div className="w-4/5 rounded-2xl bg-white p-7 text-left shadow-sm">
          <p className="mb-3 text-[13px] text-[#86868b]">Meeting notes</p>
          <p className="text-[20px] leading-relaxed font-medium">
            Ship the outline by Friday<span className="ml-0.5 inline-block h-6 w-[2px] animate-pulse bg-[#0071e3] align-middle" />
          </p>
        </div>,
      )}
      {panel(
        1,
        <div className="flex flex-col items-center gap-5 text-center">
          <span className="flex size-24 items-center justify-center rounded-[28px] bg-white shadow-sm">
            <HardDrive className="size-10 text-[#0071e3]" strokeWidth={1.5} />
          </span>
          <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[15px] shadow-sm">
            <WifiOff className="size-4 text-[#ff9f0a]" /> Offline — saved on this device
          </span>
        </div>,
      )}
      {panel(
        2,
        <div className="flex w-4/5 flex-col gap-3">
          {[
            ["Priya", "#ff375f", "Rewrote the introduction"],
            ["Ali", "#0a84ff", "Added a conclusion"],
          ].map(([who, color, what]) => (
            <div key={who} className="rounded-2xl bg-white px-5 py-4 text-left text-[15px] shadow-sm">
              <span className="font-semibold" style={{ color }}>{who}</span> · {what}
            </div>
          ))}
          <div className="flex items-center justify-center gap-2 rounded-2xl bg-[#e8f8ee] px-5 py-4 text-[15px] font-medium text-[#1d8f4e]">
            <RefreshCw className="size-4" /> Merged — nothing lost
          </div>
        </div>,
      )}
    </div>
  );
}

/** Pinned section: steps on the left change as you scroll, the picture on the right follows. */
function HowItWorks() {
  const ref = useRef<HTMLElement>(null);
  const p = useScrollProgress(ref, "sticky");
  const step = Math.min(STEPS.length - 1, Math.floor(p * STEPS.length));
  return (
    <section id="how" ref={ref} className="relative h-[300vh] scroll-mt-12 bg-white">
      <div className="sticky top-0 flex h-dvh items-center px-6">
        <div className="mx-auto grid w-full max-w-[1100px] items-center gap-12 md:grid-cols-2">
          <div>
            <p className="mb-6 text-[17px] font-semibold text-[#6e6e73]">How it works</p>
            <div className="flex flex-col gap-8">
              {STEPS.map((s, i) => (
                <div key={s.title} className="transition-opacity duration-500" style={{ opacity: i === step ? 1 : 0.25 }}>
                  <h3 className="text-[32px] leading-tight font-semibold tracking-[-0.02em] md:text-[48px]">{s.title}</h3>
                  <p className="mt-2 max-w-[440px] text-[17px] leading-relaxed text-[#6e6e73] md:text-[19px]">{s.text}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="hidden justify-center md:flex">
            <StepVisual step={step} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Tile({ className = "", children, delay = 0 }: { className?: string; children: ReactNode; delay?: number }) {
  return (
    <Reveal delay={delay} className={`overflow-hidden rounded-[28px] bg-white p-8 md:p-10 ${className}`}>
      {children}
    </Reveal>
  );
}

const TileTitle = ({ eyebrow, children }: { eyebrow: string; children: ReactNode }) => (
  <>
    <p className="text-[15px] font-semibold text-[#6e6e73]">{eyebrow}</p>
    <h3 className="mt-2 text-[28px] leading-tight font-semibold tracking-[-0.02em] md:text-[40px]">{children}</h3>
  </>
);

/** Bento grid of features on a light grey background. */
function Features() {
  return (
    <section id="features" className="scroll-mt-12 bg-[#f5f5f7] px-6 py-28 md:py-36">
      <div className="mx-auto max-w-[1100px]">
        <Reveal>
          <h2 className="mb-14 text-center text-[40px] leading-tight font-semibold tracking-[-0.025em] md:text-[64px]">Everything you need.<br />Nothing you don't.</h2>
        </Reveal>
        <div className="grid gap-5 md:grid-cols-3">
          <Tile className="md:col-span-2">
            <TileTitle eyebrow="Offline">Works with no signal.<br />At all.</TileTitle>
            <div className="mt-10 flex flex-wrap gap-3">
              {[
                ["Offline — saved on this device", "bg-[#fff4e5] text-[#a35a00]"],
                ["Syncing 3 changes…", "bg-[#e8f2ff] text-[#0058b0]"],
                ["All changes synced", "bg-[#e8f8ee] text-[#1d8f4e]"],
              ].map(([t, c]) => (
                <span key={t} className={`rounded-full px-4 py-2 text-[15px] font-medium ${c}`}>{t}</span>
              ))}
            </div>
          </Tile>
          <Tile delay={0.1} className="flex flex-col justify-between">
            <TileTitle eyebrow="Price">Free.</TileTitle>
            <p className="mt-10 text-[88px] leading-none font-semibold tracking-tight text-[#1d1d1f]">$0</p>
          </Tile>
          <Tile>
            <TileTitle eyebrow="Together">Live cursors.</TileTitle>
            <p className="mt-8 text-[19px] leading-9">
              See who's<Cursor name="Ali" color="#0a84ff" /> writing where<Cursor name="Priya" color="#ff375f" />
            </p>
          </Tile>
          <Tile delay={0.1}>
            <TileTitle eyebrow="Markdown">Write fast.<br />Read beautifully.</TileTitle>
            <pre className="mt-8 font-mono text-[14px] leading-7 text-[#6e6e73]">{"# Notes\n- [x] Outline\n**Due:** Friday"}</pre>
          </Tile>
          <Tile delay={0.2}>
            <TileTitle eyebrow="History">Every version, kept.</TileTitle>
            <div className="mt-8 flex flex-col gap-2 text-[15px] text-[#6e6e73]">
              {["Today, 10:42 — Priya", "Today, 09:15 — Ali", "Yesterday — Submitted draft"].map((v) => (
                <span key={v} className="border-b border-black/[0.06] pb-2">{v}</span>
              ))}
            </div>
          </Tile>
        </div>
      </div>
    </section>
  );
}

/** Dark band with a large gradient statement. */
function ZeroConflicts() {
  return (
    <section className="bg-black px-6 py-36 text-center md:py-52">
      <Reveal>
        <p className="text-[21px] font-semibold text-[#86868b]">Powered by CRDTs</p>
        <h2 className="mt-4 bg-gradient-to-b from-white to-[#6e6e73] bg-clip-text text-[64px] leading-none font-semibold tracking-[-0.03em] text-transparent md:text-[140px]">
          Zero conflicts.
        </h2>
        <p className="mx-auto mt-8 max-w-[620px] text-[19px] leading-relaxed text-[#a1a1a6] md:text-[24px]">
          Two people edit the same paragraph on a plane. They land, reconnect, and both see the same document. Nobody is asked to choose.
        </p>
      </Reveal>
    </section>
  );
}

const FAQ = [
  ["Does it really work without internet?", "Yes. After your first visit the whole app is stored on your device. You can create, edit, organise and search with no connection."],
  ["What if two people edit the same paragraph offline?", "Both changes are kept. Every device ends up with exactly the same document, without a conflict dialog."],
  ["Where is my data stored?", "On your device first. A copy is kept on the sync server so your teammates and other devices receive your changes."],
  ["How much does it cost?", "Nothing. SyncScribe is a university project built with free and open-source tools."],
];

function Faq() {
  return (
    <section id="faq" className="scroll-mt-12 px-6 py-28 md:py-36">
      <div className="mx-auto max-w-[760px]">
        <Reveal>
          <h2 className="mb-12 text-center text-[40px] font-semibold tracking-[-0.025em] md:text-[56px]">Questions? Answers.</h2>
        </Reveal>
        <div className="border-t border-[#d2d2d7]">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group border-b border-[#d2d2d7] py-6">
              <summary className="flex cursor-pointer list-none items-center justify-between text-[19px] font-semibold md:text-[21px]">
                {q}
                <span className="ml-6 text-[28px] leading-none font-light text-[#86868b] transition-transform duration-300 group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 pr-10 text-[17px] leading-relaxed text-[#6e6e73]">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const signedIn = useSession((s) => s.status === "signedIn");
  const cta = signedIn ? { to: "/", label: "Open SyncScribe" } : { to: "/signup", label: "Get started" };

  return (
    <div style={FONT} className="min-h-dvh bg-white text-[#1d1d1f] antialiased">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-black/[0.06] bg-white/70 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-12 max-w-[1024px] items-center justify-between px-6 text-[13px]">
          <Link to="/welcome" className="font-semibold tracking-tight">SyncScribe</Link>
          <nav className="hidden items-center gap-8 text-[#1d1d1f]/80 md:flex">
            <a href="#features" className="hover:text-[#1d1d1f]">Features</a>
            <a href="#how" className="hover:text-[#1d1d1f]">How it works</a>
            <a href="#faq" className="hover:text-[#1d1d1f]">FAQ</a>
          </nav>
          <div className="flex items-center gap-4">
            {!signedIn && <Link to="/login" className="text-[#1d1d1f]/80 hover:text-[#1d1d1f]">Sign in</Link>}
            <Link to={cta.to} className="rounded-full bg-[#0071e3] px-3.5 py-1 text-white hover:bg-[#0077ed]">
              {signedIn ? "Open" : "Get started"}
            </Link>
          </div>
        </div>
      </header>

      <Hero cta={cta} />
      <Statement />
      <HowItWorks />
      <Features />
      <ZeroConflicts />
      <Faq />

      {/* Closing call to action */}
      <section className="px-6 pb-32 text-center">
        <Reveal>
          <h2 className="text-[40px] leading-tight font-semibold tracking-[-0.025em] md:text-[72px]">Start writing today.</h2>
          <p className="mx-auto mt-4 max-w-[520px] text-[21px] text-[#6e6e73]">Free account. Ready in seconds. Connection optional.</p>
          <div className="mt-8">
            <Link to={cta.to} className={blueButton}>{cta.label}</Link>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="bg-[#f5f5f7] px-6 py-10 text-[12px] text-[#6e6e73]">
        <div className="mx-auto max-w-[1024px]">
          <p className="border-b border-[#d2d2d7] pb-4">
            SyncScribe is a local-first collaborative markdown workspace, built as a university project with free and open-source tools.
          </p>
          <div className="grid grid-cols-2 gap-8 py-6 md:grid-cols-4">
            {[
              ["Explore", [["Features", "#features"], ["How it works", "#how"], ["FAQ", "#faq"]]],
              ["Account", [["Sign in", "/login"], ["Create account", "/signup"]]],
              ["Built with", [["Yjs CRDTs", "#how"], ["IndexedDB", "#how"], ["Service Workers", "#how"]]],
              ["Project", [["University project", "#"]]],
            ].map(([title, links]) => (
              <div key={title as string}>
                <p className="mb-2 font-semibold text-[#1d1d1f]">{title as string}</p>
                <ul className="flex flex-col gap-1.5">
                  {(links as string[][]).map(([label, href]) => (
                    <li key={label}>
                      {href.startsWith("/") ? <Link to={href} className="hover:underline">{label}</Link> : <a href={href} className="hover:underline">{label}</a>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="border-t border-[#d2d2d7] pt-4">Copyright © {new Date().getFullYear()} SyncScribe. University project.</p>
        </div>
      </footer>
    </div>
  );
}
