import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { ArrowRight, Check, CloudOff, FileText, GitMerge, HardDrive, NotebookPen, RefreshCw, Users, Wifi, WifiOff } from "lucide-react";
import { useSession } from "../stores/session";
import { primaryButton } from "../components/ui";

// Public landing page: one long scroll (nav, hero, tech strip, features, how it works, FAQ, CTA, footer).

/** Fades a block up when it scrolls into view (skipped for reduced-motion users via CSS). */
function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return setShown(true);
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setShown(true), io.disconnect()), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out motion-reduce:transition-none ${shown ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"} ${className}`}
    >
      {children}
    </div>
  );
}

const secondaryButton =
  "rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium transition hover:bg-hover dark:border-white/10 dark:bg-transparent";

/** Window frame used for the product mock-ups. */
function Frame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-line bg-white shadow-[0_20px_60px_rgb(0_0_0/0.08)] dark:border-white/10 dark:bg-[#1c1c1c] ${className}`}>
      <div className="flex items-center gap-1.5 border-b border-line px-4 py-2.5 dark:border-white/10">
        <span className="size-2.5 rounded-full bg-[#ff5f57]" />
        <span className="size-2.5 rounded-full bg-[#febc2e]" />
        <span className="size-2.5 rounded-full bg-[#28c840]" />
      </div>
      {children}
    </div>
  );
}

const Line = ({ w, strong = false }: { w: string; strong?: boolean }) => (
  <div className={`h-2.5 rounded-full ${strong ? "bg-black/15 dark:bg-white/20" : "bg-black/[0.07] dark:bg-white/10"}`} style={{ width: w }} />
);

/** Two-person cursor shown in the mock editor. */
const Cursor = ({ name, color }: { name: string; color: string }) => (
  <span className="relative inline-block h-4 w-0.5 translate-y-0.5 align-middle" style={{ backgroundColor: color }}>
    <span className="absolute -top-5 left-0 rounded px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap text-white" style={{ backgroundColor: color }}>
      {name}
    </span>
  </span>
);

/** Hero mock-up: the SyncScribe app with a sidebar and two people editing. */
function AppMock() {
  return (
    <Frame>
      <div className="flex h-[340px] text-left sm:h-[420px]">
        <div className="hidden w-48 shrink-0 flex-col gap-2 border-r border-line bg-panel p-3 sm:flex dark:border-white/10 dark:bg-white/5">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium">
            <span className="flex size-5 items-center justify-center rounded bg-brand text-[10px] text-white">G</span> Group project
          </div>
          {["All docs", "Recent", "Organize"].map((t) => (
            <span key={t} className="text-[11px] text-muted">{t}</span>
          ))}
          {["Introduction", "Research notes", "Final report"].map((t, i) => (
            <span key={t} className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs ${i === 2 ? "bg-active font-medium" : ""}`}>
              <FileText className="size-3 text-muted" /> {t}
            </span>
          ))}
        </div>
        <div className="flex-1 px-6 py-8 sm:px-12">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-2xl font-bold tracking-tight sm:text-3xl">Final report</p>
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              <Check className="size-3" /> Synced
            </span>
          </div>
          <p className="mb-6 text-xs text-muted">Edited by Priya and Ali · just now</p>
          <p className="mb-3 text-sm font-semibold">## Introduction</p>
          <p className="mb-5 text-sm leading-7 text-ink/80 dark:text-white/80">
            Local-first apps keep working without the internet <Cursor name="Priya" color="#e11d48" /> and merge everyone's edits when
            devices reconnect <Cursor name="Ali" color="#2563eb" />
          </p>
          <div className="flex flex-col gap-2.5">
            <Line w="92%" />
            <Line w="78%" />
            <Line w="85%" />
            <Line w="40%" />
          </div>
        </div>
      </div>
    </Frame>
  );
}

const TECH = ["Yjs CRDTs", "IndexedDB", "Service Workers", "React", "CodeMirror", "Hocuspocus", "SQLite", "Markdown", "PWA"];

/** Endless strip of the technologies SyncScribe is built on. */
function TechStrip() {
  return (
    <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_15%,black_85%,transparent)]">
      <div className="flex w-max animate-[marquee_30s_linear_infinite] gap-3 motion-reduce:animate-none">
        {[...TECH, ...TECH].map((t, i) => (
          <span key={i} className="rounded-full border border-line px-4 py-1.5 text-sm whitespace-nowrap text-muted dark:border-white/10">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Mock for "Write": markdown on the left, preview on the right. */
function WriteMock() {
  return (
    <Frame>
      <div className="grid grid-cols-2 divide-x divide-line text-left dark:divide-white/10">
        <pre className="p-5 font-mono text-[12px] leading-6 text-muted">{`# Meeting notes\n\n- [x] Pick a topic\n- [ ] Draft outline\n\n**Due:** Friday`}</pre>
        <div className="p-5 text-[13px] leading-6">
          <p className="mb-2 text-lg font-bold">Meeting notes</p>
          <p>☑ Pick a topic</p>
          <p>☐ Draft outline</p>
          <p className="mt-2"><b>Due:</b> Friday</p>
        </div>
      </div>
    </Frame>
  );
}

/** Mock for "Offline": status badges going offline → syncing → synced. */
function OfflineMock() {
  const states = [
    { icon: WifiOff, text: "Offline — changes saved on this device", cls: "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200" },
    { icon: RefreshCw, text: "Back online — syncing 3 changes…", cls: "bg-sky-50 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200" },
    { icon: Check, text: "All changes synced", cls: "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200" },
  ];
  return (
    <Frame>
      <div className="flex flex-col gap-3 p-6 text-left">
        {states.map(({ icon: Icon, text, cls }) => (
          <div key={text} className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${cls}`}>
            <Icon className="size-4" /> {text}
          </div>
        ))}
      </div>
    </Frame>
  );
}

/** Mock for "Merge": two offline versions becoming one. */
function MergeMock() {
  const Card = ({ who, color, text }: { who: string; color: string; text: string }) => (
    <div className="rounded-xl border border-line p-3 text-left text-[13px] dark:border-white/10">
      <p className="mb-1 text-[11px] font-medium" style={{ color }}>{who} · offline</p>
      <p>{text}</p>
    </div>
  );
  return (
    <Frame>
      <div className="flex flex-col gap-3 p-6">
        <div className="grid grid-cols-2 gap-3">
          <Card who="Priya" color="#e11d48" text="Rewrote the introduction" />
          <Card who="Ali" color="#2563eb" text="Added a conclusion" />
        </div>
        <GitMerge className="mx-auto size-5 rotate-180 text-muted" />
        <div className="rounded-xl bg-emerald-50 p-3 text-left text-[13px] dark:bg-emerald-500/10">
          <p className="mb-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">Merged automatically</p>
          <p>New introduction + new conclusion — nothing lost, no conflict dialog.</p>
        </div>
      </div>
    </Frame>
  );
}

function Feature({ label, title, accent, text, visual, flip = false }: { label: string; title: string; accent: string; text: string; visual: ReactNode; flip?: boolean }) {
  return (
    <Reveal className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
      <div className={flip ? "md:order-2" : ""}>
        <p className="mb-3 text-sm font-medium text-brand">{label}</p>
        <h3 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
          {title} <span className="text-brand">{accent}</span>
        </h3>
        <p className="text-lg leading-relaxed text-muted">{text}</p>
      </div>
      <div className={flip ? "md:order-1" : ""}>{visual}</div>
    </Reveal>
  );
}

const STEPS = [
  { icon: NotebookPen, title: "You type", text: "Every keystroke becomes a small change in your document." },
  { icon: HardDrive, title: "Saved on your device", text: "Changes are stored in your browser instantly — no Save button, no waiting." },
  { icon: Users, title: "Synced & merged", text: "When online, changes flow to your team and merge automatically with theirs." },
];

const FAQ = [
  { q: "Does it really work without internet?", a: "Yes. After your first visit the whole app is stored on your device. You can create, edit, organise and search documents with no connection at all." },
  { q: "What happens if two people edit the same paragraph offline?", a: "Both sets of changes are kept. SyncScribe uses CRDTs, so every device ends up with exactly the same document — without asking anyone to pick a version." },
  { q: "Where is my data stored?", a: "First on your own device (IndexedDB). A copy is kept on the sync server so your teammates and your other devices can receive your changes." },
  { q: "How much does it cost?", a: "Nothing. SyncScribe is a university project built entirely with free and open-source tools." },
];

const CHIPS = ["Lecture notes", "Group reports", "Meeting notes", "Team wiki", "Research logs", "To-do lists"];

export default function LandingPage() {
  const signedIn = useSession((s) => s.status === "signedIn");
  const cta = signedIn ? { to: "/", label: "Open SyncScribe" } : { to: "/signup", label: "Get started — it's free" };

  return (
    <div className="min-h-dvh bg-white text-ink dark:bg-[#141414] dark:text-[#e8e8e8]">
      <style>{`@keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>

      {/* Navigation */}
      <header className="sticky top-0 z-40 border-b border-transparent bg-white/80 backdrop-blur-md dark:bg-[#141414]/80">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-8 px-6">
          <Link to="/welcome" className="flex items-center gap-2 font-semibold">
            <span className="flex size-7 items-center justify-center rounded-lg bg-brand text-white">
              <NotebookPen className="size-4" />
            </span>
            SyncScribe
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted md:flex">
            <a href="#features" className="hover:text-ink dark:hover:text-white">Features</a>
            <a href="#how" className="hover:text-ink dark:hover:text-white">How it works</a>
            <a href="#faq" className="hover:text-ink dark:hover:text-white">FAQ</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {!signedIn && (
              <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-hover dark:hover:bg-white/5">
                Sign in
              </Link>
            )}
            <Link to={cta.to} className={primaryButton}>
              {signedIn ? "Open app" : "Get started"}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-[1200px] px-6 pt-16 pb-20 text-center md:pt-24">
        <Reveal>
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-[13px] text-muted dark:border-white/10">
            <CloudOff className="size-3.5 text-brand" /> Local-first · Works offline
          </span>
          <h1 className="mx-auto max-w-[820px] text-[44px] leading-[1.05] font-bold tracking-tight md:text-[72px]">
            Write together, <span className="text-brand">even offline.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-[620px] text-lg leading-relaxed text-muted md:text-xl">
            SyncScribe is a markdown workspace that saves everything on your device first and merges your team's edits
            automatically when you reconnect.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to={cta.to} className={`${primaryButton} flex items-center gap-1.5 px-5 py-2.5`}>
              {cta.label} <ArrowRight className="size-4" />
            </Link>
            <a href="#how" className={`${secondaryButton} px-5 py-2.5`}>See how it works</a>
          </div>
        </Reveal>
        <Reveal className="mx-auto mt-16 max-w-[1000px]">
          <AppMock />
        </Reveal>
      </section>

      {/* Built-on strip */}
      <section className="mx-auto max-w-[1200px] px-6 pb-24">
        <p className="mb-6 text-center text-sm text-muted">Built on proven, open-source local-first technology</p>
        <TechStrip />
      </section>

      {/* One workspace */}
      <section className="bg-panel py-24 dark:bg-white/[0.03]">
        <Reveal className="mx-auto max-w-[900px] px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-5xl">One calm place for everything you write</h2>
          <p className="mx-auto mt-5 max-w-[600px] text-lg text-muted">Folders, search, version history and sharing — all working with or without a connection.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {CHIPS.map((c) => (
              <span key={c} className="rounded-full bg-white px-4 py-2 text-sm shadow-sm dark:bg-white/10">{c}</span>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto flex max-w-[1200px] scroll-mt-20 flex-col gap-28 px-6 py-28">
        <Feature label="Write" title="Markdown that" accent="stays out of your way." text="A focused editor with live preview, side-by-side view, tables, task lists and code blocks. Your words autosave on every keystroke." visual={<WriteMock />} />
        <Feature flip label="Offline" title="No signal?" accent="Keep going." text="Trains, flights, lecture halls with bad Wi-Fi — SyncScribe keeps working. A clear status badge always tells you what's saved and what's synced." visual={<OfflineMock />} />
        <Feature label="Collaborate" title="Edit at the same time," accent="never overwrite." text="See teammates' cursors live. Edit the same document offline. When you reconnect, every change is merged — no conflict dialogs, no lost paragraphs." visual={<MergeMock />} />
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-20 bg-panel py-28 dark:bg-white/[0.03]">
        <div className="mx-auto max-w-[1200px] px-6">
          <Reveal className="mb-14 text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-5xl">How it works</h2>
            <p className="mx-auto mt-4 max-w-[560px] text-lg text-muted">Your device is the source of truth. The network is a bonus.</p>
          </Reveal>
          <div className="grid gap-5 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <Reveal key={title}>
                <div className="h-full rounded-2xl bg-white p-7 shadow-sm dark:bg-white/5">
                  <div className="mb-5 flex items-center justify-between">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                      <Icon className="size-5" />
                    </span>
                    <span className="text-sm font-medium text-muted">0{i + 1}</span>
                  </div>
                  <h3 className="mb-2 text-xl font-semibold">{title}</h3>
                  <p className="leading-relaxed text-muted">{text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-[800px] scroll-mt-20 px-6 py-28">
        <Reveal>
          <h2 className="mb-10 text-center text-3xl font-bold tracking-tight md:text-5xl">Questions</h2>
          <div className="divide-y divide-line border-y border-line dark:divide-white/10 dark:border-white/10">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between text-lg font-medium">
                  {q}
                  <span className="ml-4 text-2xl leading-none text-muted transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 leading-relaxed text-muted">{a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Closing CTA */}
      <section className="px-6 pb-24">
        <Reveal className="mx-auto max-w-[1200px] rounded-3xl bg-ink px-6 py-20 text-center text-white dark:bg-white/[0.06]">
          <Wifi className="mx-auto mb-6 size-8 text-brand" />
          <h2 className="text-3xl font-bold tracking-tight md:text-5xl">Start writing. Connection optional.</h2>
          <p className="mx-auto mt-4 max-w-[520px] text-lg text-white/60">Create a free account and your workspace is ready in seconds.</p>
          <Link to={cta.to} className={`${primaryButton} mt-8 inline-flex items-center gap-1.5 px-6 py-3`}>
            {cta.label} <ArrowRight className="size-4" />
          </Link>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-line dark:border-white/10">
        <div className="mx-auto grid max-w-[1200px] gap-10 px-6 py-14 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <p className="mb-3 flex items-center gap-2 font-semibold">
              <span className="flex size-6 items-center justify-center rounded-md bg-brand text-white">
                <NotebookPen className="size-3.5" />
              </span>
              SyncScribe
            </p>
            <p className="text-sm text-muted">Local-first collaborative markdown workspace.</p>
          </div>
          {[
            { title: "Product", links: [["Features", "#features"], ["How it works", "#how"], ["FAQ", "#faq"]] },
            { title: "Account", links: [["Sign in", "/login"], ["Create account", "/signup"]] },
            { title: "Project", links: [["University project", "#"], ["Free & open-source tools", "#how"]] },
          ].map((col) => (
            <div key={col.title}>
              <p className="mb-3 text-sm font-semibold">{col.title}</p>
              <ul className="flex flex-col gap-2 text-sm text-muted">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    {href.startsWith("/") ? <Link to={href} className="hover:text-ink dark:hover:text-white">{label}</Link> : <a href={href} className="hover:text-ink dark:hover:text-white">{label}</a>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="border-t border-line py-6 text-center text-[13px] text-muted dark:border-white/10">
          © {new Date().getFullYear()} SyncScribe · Built for a university project
        </p>
      </footer>
    </div>
  );
}
