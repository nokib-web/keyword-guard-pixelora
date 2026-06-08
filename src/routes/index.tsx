import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import React, { useEffect, useMemo, useState } from "react";
import { Type, FileText, ShieldAlert, AlertTriangle, Copy, Trash2, ShieldCheck, Info, X, Plus, Wand2, Lock, LockOpen, Loader2, Check, ClipboardPaste, Sun, Moon } from "lucide-react";
import { listKeywords, addKeyword, removeKeyword } from "@/lib/keywords.functions";
import logoMark from "@/assets/logo-mark.jpg";

function FloatingLogos() {
  const [items, setItems] = useState<Array<{ top: number; left: number; size: number; dur: number; delay: number; anim: string; opacity: number }>>([]);
  useEffect(() => {
    setItems(
      Array.from({ length: 10 }).map((_, i) => ({
        top: Math.random() * 90,
        left: Math.random() * 92,
        size: 50 + Math.random() * 90,
        dur: 14 + Math.random() * 18,
        delay: -Math.random() * 20,
        anim: ["float-a", "float-b", "float-c"][i % 3],
        opacity: 0.05 + Math.random() * 0.09,
      })),
    );
  }, []);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {items.map((it, i) => (
        <img
          key={i}
          src={logoMark}
          alt=""
          className="floating-logo"
          style={{
            top: `${it.top}%`,
            left: `${it.left}%`,
            width: it.size,
            height: it.size,
            opacity: it.opacity,
            animation: `${it.anim} ${it.dur}s ease-in-out ${it.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function maskWord(word: string): string {
  // Single dash in the middle of the word
  if (word.length < 2) return word;
  const mid = Math.ceil(word.length / 2);
  return word.slice(0, mid) + "-" + word.slice(mid);
}

type Segment = { text: string; banned: boolean };

function rewriteToSegments(text: string, keywords: string[]): Segment[] {
  if (!text) return [];
  // Build a single regex matching any keyword as a substring (always — even inside larger words).
  const valid = keywords.filter(Boolean);
  if (valid.length === 0) return [{ text, banned: false }];
  const sorted = [...valid].sort((a, b) => b.length - a.length);
  const pattern = sorted.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const re = new RegExp(pattern, "gi");
  const segs: Segment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segs.push({ text: text.slice(last, m.index), banned: false });
    const match = m[0];
    let masked: string;
    if (/^[a-z0-9]+$/i.test(match)) {
      masked = maskWord(match);
    } else {
      masked = match.split("").join("-");
    }
    // If the original keyword contains @, replace it with (at)
    if (match.includes("@")) {
      masked = masked.replace(/@/g, "(at)");
    }
    segs.push({ text: masked, banned: true });
    last = m.index + match.length;
    if (match.length === 0) re.lastIndex++;
  }
  if (last < text.length) segs.push({ text: text.slice(last), banned: false });
  return segs;
}

function segmentsToString(segs: Segment[]): string {
  return segs.map((s) => s.text).join("");
}

function renderSegments(segs: Segment[]): React.ReactNode {
  return segs.map((s, i) =>
    s.banned ? (
      <mark
        key={i}
        style={{ backgroundColor: "color-mix(in oklab, var(--brand-red) 25%, transparent)", color: "var(--brand-red)" }}
        className="rounded px-0.5 font-semibold"
      >
        {s.text}
      </mark>
    ) : (
      <span key={i}>{s.text}</span>
    ),
  );
}

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Keyword Guard — Fiverr Compliance Keyword Checker" },
      { name: "description", content: "Check your content for forbidden keywords, words, characters and grammar issues before posting." },
    ],
  }),
});

const DEFAULT_KEYWORDS: string[] = [
  "crypto", "payment", "instagram", "linkedin", "facebook", "negative", "star", "transferwise",
  "account", "bank", "messenger", "skype", "card", "credit", "purchase", "whatsapp",
  "sms", "transaction", "stripe", "paypal", "rating", "review", "euro", "dollar",
  "money", "pay", "contact", "email", "gmail", "mail", "@", "feedback"
];

type GrammarIssueType = "double-space" | "space-before-punct" | "repeated-word" | "not-capitalized" | "missing-end-punct";
type GrammarIssue = { type: GrammarIssueType; label: string };

// Tiny grammar heuristic: double spaces, lowercase sentence starts, missing end punctuation, repeated words.
function findGrammarIssues(text: string): GrammarIssue[] {
  if (!text.trim()) return [];
  const issues: GrammarIssue[] = [];
  if (/ {2,}/.test(text)) issues.push({ type: "double-space", label: "Multiple consecutive spaces" });
  if (/\s+[.,!?;:]/.test(text)) issues.push({ type: "space-before-punct", label: "Space before punctuation" });
  if (/\b(\w+)\s+\1\b/i.test(text)) issues.push({ type: "repeated-word", label: "Repeated word" });
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  for (const s of sentences) {
    const first = s.trim()[0];
    if (first && first === first.toLowerCase() && /[a-z]/.test(first)) {
      issues.push({ type: "not-capitalized", label: "Sentence not capitalized" });
      break;
    }
  }
  const trimmed = text.trim();
  if (trimmed.length > 20 && !/[.!?]$/.test(trimmed)) issues.push({ type: "missing-end-punct", label: "Missing end punctuation" });
  return issues;
}

function fixGrammarIssue(text: string, type: GrammarIssueType): string {
  switch (type) {
    case "double-space":
      return text.replace(/ {2,}/g, " ");
    case "space-before-punct":
      return text.replace(/\s+([.,!?;:])/g, "$1");
    case "repeated-word":
      return text.replace(/\b(\w+)(\s+\1\b)+/gi, "$1");
    case "not-capitalized":
      return text.replace(/(^|[.!?]\s+)([a-z])/g, (_m, p1, p2) => p1 + p2.toUpperCase());
    case "missing-end-punct": {
      const t = text.replace(/\s+$/, "");
      return /[.!?]$/.test(t) ? text : t + ".";
    }
    default:
      return text;
  }
}

function Index() {
  const [text, setText] = useState("");
  const [keywords, setKeywords] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("forbidden_keywords");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return DEFAULT_KEYWORDS;
        }
      }
    }
    return DEFAULT_KEYWORDS;
  });
  const [loading, setLoading] = useState(true);
  const [newKeyword, setNewKeyword] = useState("");
  
  const [showPass, setShowPass] = useState(false);
  const [pendingAction, setPendingAction] = useState<null | { type: "add" } | { type: "remove"; word: string }>(null);
  const [passInput, setPassInput] = useState("");
  const [passError, setPassError] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<Record<string, boolean>>({});
  const taRef = React.useRef<HTMLTextAreaElement | null>(null);
  const fixedRef = React.useRef<HTMLDivElement | null>(null);

  // Theme toggle (default dark)
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("theme");
    if (stored) return stored === "dark";
    return true;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark((d) => !d);

  // Global paste handler: Ctrl+V anywhere pastes into the left textarea
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      // Let natural paste happen if already typing in the textarea
      if (e.target === taRef.current) return;
      const pasted = e.clipboardData?.getData("text");
      if (!pasted) return;
      e.preventDefault();
      setText(pasted);
      triggerFlash("paste");
      setTimeout(() => taRef.current?.focus(), 0);
    };
    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  }, []);

  const triggerFlash = (key: string) => {
    setFlash((p) => ({ ...p, [key]: true }));
    setTimeout(() => setFlash((p) => ({ ...p, [key]: false })), 1500);
  };
  const doCopy = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    triggerFlash(key);
  };


  const list = useServerFn(listKeywords);
  const add = useServerFn(addKeyword);
  const remove = useServerFn(removeKeyword);

  const refresh = async () => {
    try {
      const res = await list();
      if (res && Array.isArray(res.words)) {
        setKeywords(res.words);
        if (typeof window !== "undefined") {
          localStorage.setItem("forbidden_keywords", JSON.stringify(res.words));
        }
      }
    } catch (e) {
      console.error("[Keywords] Failed to fetch keywords from server, using local fallback:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  

  const stats = useMemo(() => {
    const trimmed = text.trim();
    const words = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
    const chars = text.length;
    const lower = text.toLowerCase();
    const found: { word: string; count: number }[] = [];
    let bannedTotal = 0;
    for (const kw of keywords) {
      const k = kw.toLowerCase();
      if (!k) continue;
      const re = new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      const count = (lower.match(re) || []).length;
      if (count > 0) {
        found.push({ word: kw, count });
        bannedTotal += count;
      }
    }
    const grammar = findGrammarIssues(text);
    const segments = rewriteToSegments(text, keywords);
    const fixed = segmentsToString(segments);
    return { words, chars, found, bannedTotal, grammar, fixed, segments };
  }, [text, keywords]);

  const isClean = text.trim().length > 0 && stats.found.length === 0 && stats.grammar.length === 0;

  const performAdd = async (password: string) => {
    const k = newKeyword.trim().toLowerCase();
    if (!k || keywords.includes(k)) return;
    setBusy(true);
    try {
      await add({ data: { word: k, password } });
      setKeywords((prev) => {
        const next = prev.includes(k) ? prev : [...prev, k];
        if (typeof window !== "undefined") {
          localStorage.setItem("forbidden_keywords", JSON.stringify(next));
        }
        return next;
      });
      setNewKeyword("");
    } catch (e) {
      console.error("[Keywords] Failed to add keyword on server, doing local add:", e);
      setKeywords((prev) => {
        const next = prev.includes(k) ? prev : [...prev, k];
        if (typeof window !== "undefined") {
          localStorage.setItem("forbidden_keywords", JSON.stringify(next));
        }
        return next;
      });
      setNewKeyword("");
    } finally {
      setBusy(false);
    }
  };

  const performRemove = async (k: string, password: string) => {
    setBusy(true);
    try {
      await remove({ data: { word: k, password } });
      setKeywords((prev) => {
        const next = prev.filter((x) => x !== k);
        if (typeof window !== "undefined") {
          localStorage.setItem("forbidden_keywords", JSON.stringify(next));
        }
        return next;
      });
    } catch (e) {
      console.error("[Keywords] Failed to remove keyword on server, doing local remove:", e);
      setKeywords((prev) => {
        const next = prev.filter((x) => x !== k);
        if (typeof window !== "undefined") {
          localStorage.setItem("forbidden_keywords", JSON.stringify(next));
        }
        return next;
      });
    } finally {
      setBusy(false);
    }
  };

  const requestAdd = () => {
    if (!newKeyword.trim()) return;
    setPendingAction({ type: "add" });
    setShowPass(true);
  };

  const requestRemove = (k: string) => {
    setPendingAction({ type: "remove", word: k });
    setShowPass(true);
  };

  const submitPass = async () => {
    const pass = passInput;
    if (pass !== "6746") {
      setPassError("Wrong password");
      return;
    }
    setShowPass(false);
    setPassInput("");
    setPassError("");
    if (pendingAction?.type === "add") await performAdd(pass);
    else if (pendingAction?.type === "remove") await performRemove(pendingAction.word, pass);
    setPendingAction(null);
  };

  const closePass = () => {
    setShowPass(false);
    setPassInput("");
    setPassError("");
    setPendingAction(null);
  };


  return (
    <div className="min-h-screen bg-background dark:bg-[oklch(0.13_0.02_150)] text-foreground relative overflow-hidden">
      {/* floating brand marks */}
      <FloatingLogos />

      {/* glow */}
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full blur-3xl"
             style={{ background: "radial-gradient(circle, var(--brand-green-glow), transparent 70%)" }} />
      </div>

      <main className="relative max-w-[1700px] mx-auto px-4 py-10 md:py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex-1 flex flex-col items-center text-center">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-foreground">
              Keyword <span className="text-[var(--brand-green)]">Guard</span>
            </h1>
            <p className="mt-3 text-muted-foreground text-base md:text-lg">
              Check if your content contains any forbidden keywords
            </p>
          </div>
          <button
            onClick={toggleTheme}
            className="ml-4 inline-flex items-center justify-center w-10 h-10 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.03] text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition shrink-0"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
          <StatCard icon={<Type className="w-5 h-5" />} label="Words" value={stats.words} color="var(--brand-purple)" />
          <StatCard icon={<FileText className="w-5 h-5" />} label="Characters" value={stats.chars} color="oklch(0.7 0.05 250)" />
          <StatCard icon={<ShieldAlert className="w-5 h-5" />} label="Banned Words" value={stats.bannedTotal}
                    color={stats.bannedTotal ? "var(--brand-red)" : "var(--brand-green)"} />
          <StatCard icon={<AlertTriangle className="w-5 h-5" />} label="Grammar Issues" value={stats.grammar.length}
                    color={stats.grammar.length ? "var(--brand-amber)" : "var(--brand-green)"} />
        </div>

        {/* Editor + Results */}
        <div className="grid md:grid-cols-2 gap-5 items-stretch">
          {/* Editor */}
          <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.03] backdrop-blur-xl p-4 flex flex-col h-[600px] shadow-[0_0_60px_-30px_var(--brand-green-glow)] transition-all duration-300 focus-within:border-[var(--brand-green)] focus-within:shadow-[0_0_0_1px_var(--brand-green),0_0_40px_-5px_var(--brand-green-glow)]">
            <textarea
              ref={taRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onScroll={(e) => {
                const src = e.currentTarget;
                const dst = fixedRef.current;
                if (!dst) return;
                const sMax = src.scrollHeight - src.clientHeight;
                const dMax = dst.scrollHeight - dst.clientHeight;
                if (sMax <= 0 || dMax <= 0) return;
                dst.scrollTop = (src.scrollTop / sMax) * dMax;
              }}
              placeholder="Paste your gig description, profile, or message here..."
              className="w-full flex-1 min-h-0 bg-transparent resize-none outline-none text-foreground placeholder:text-muted-foreground text-[17px] leading-relaxed overflow-y-auto"
            />

            <div className="flex gap-2 pt-3 border-t border-black/10 dark:border-white/10">
              <button
                onClick={async () => {
                  try {
                    const t = await navigator.clipboard.readText();
                    if (t) { setText(t); triggerFlash("paste"); }
                  } catch (e) { console.error(e); }
                }}
                className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-base font-semibold bg-black/10 text-foreground hover:bg-black/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15 transition shrink-0"
              >
                {flash.paste ? (<><Check className="w-5 h-5" /> Pasted!</>) : (<><ClipboardPaste className="w-5 h-5" /> Paste</>)}
              </button>
              <button
                onClick={() => doCopy("fix", stats.fixed)}
                disabled={!text.trim()}
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-base font-semibold bg-[var(--brand-green)] text-black hover:brightness-110 transition disabled:opacity-40 disabled:hover:brightness-100 shadow-[0_0_30px_-8px_var(--brand-green-glow)]"
              >
                {flash.fix ? (<><Check className="w-5 h-5" /> Fixed & Copied!</>) : (<><Wand2 className="w-5 h-5" /> Fix & Rewrite</>)}
              </button>
            </div>
          </div>

          {/* Results */}
          <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.03] backdrop-blur-xl p-5 flex flex-col h-[600px] overflow-hidden">
            {!text.trim() ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center min-h-[460px]">
                <div className="w-12 h-12 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center mb-3">
                  <Info className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">Paste your content above to check</p>
              </div>
            ) : isClean ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center min-h-[460px]">
                <div className="w-14 h-14 rounded-full bg-[var(--brand-green)]/15 flex items-center justify-center mb-3">
                  <ShieldCheck className="w-7 h-7 text-[var(--brand-green)]" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">All clear!</h3>
                <p className="text-muted-foreground mt-1">No forbidden keywords found.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4 flex-1 min-h-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[var(--brand-green)] uppercase tracking-wider">
                    Fixed Text
                  </h3>
                  <button
                    onClick={() => doCopy("fixed", stats.fixed)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-[var(--brand-green)]/15 text-[var(--brand-green)] hover:bg-[var(--brand-green)]/25 transition"
                  >
                    {flash.fixed ? (<><Check className="w-3.5 h-3.5" /> Copied!</>) : (<><Copy className="w-3.5 h-3.5" /> Copy fixed</>)}
                  </button>
                </div>
                <div
                  ref={fixedRef}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
                      e.preventDefault();
                      const el = fixedRef.current;
                      if (el) {
                        const range = document.createRange();
                        range.selectNodeContents(el);
                        const sel = window.getSelection();
                        sel?.removeAllRanges();
                        sel?.addRange(range);
                      }
                    }
                  }}
                  className="flex-1 min-h-0 overflow-y-auto rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 backdrop-blur p-3 text-[17px] leading-relaxed text-foreground whitespace-pre-wrap break-words outline-none focus:border-[var(--brand-green)]/40"
                >
                  {renderSegments(stats.segments)}
                </div>
                {stats.found.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {stats.found.map((f) => (
                      <span key={f.word}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-[var(--brand-red)]/15 text-[var(--brand-red)] border border-[var(--brand-red)]/30">
                        {f.word}
                        <span className="text-[10px] px-1.5 rounded-full bg-[var(--brand-red)]/25">×{f.count}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

        {/* Actions below both boxes */}
        <div className="flex justify-center gap-2 mt-4">
          <button
            onClick={() => doCopy("orig", stats.fixed)}
            disabled={!text.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm text-foreground/80 hover:text-foreground bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 transition disabled:opacity-40"
          >
            {flash.orig ? (<><Check className="w-4 h-4" /> Copied!</>) : (<><Copy className="w-4 h-4" /> Copy fixed</>)}
          </button>
          <button
            onClick={() => setText("")}
            disabled={!text.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm text-foreground/80 hover:text-foreground bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 transition disabled:opacity-40"
          >
            <Trash2 className="w-4 h-4" /> Clear
          </button>
        </div>


        {/* Keywords manager */}
        <section className="mt-6 rounded-2xl border border-[var(--brand-green)]/20 bg-black/[0.02] dark:bg-white/[0.02] backdrop-blur-xl p-5">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <h2 className="text-sm font-semibold text-[var(--brand-green)] uppercase tracking-wider flex items-center gap-2">
              Forbidden Keywords ({keywords.length})
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/5 text-muted-foreground normal-case tracking-normal">
                <Lock className="w-3 h-3" /> locked
              </span>
            </h2>
            <div className="flex items-center gap-2">
              <input
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && requestAdd()}
                placeholder="Add keyword..."
                className="px-3 py-1.5 rounded-md bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-[var(--brand-green)]/50"
              />
              <button onClick={requestAdd} disabled={busy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-[var(--brand-green)]/15 text-[var(--brand-green)] hover:bg-[var(--brand-green)]/25 transition disabled:opacity-50">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {loading && (
              <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
              </span>
            )}
            {keywords.map((k) => (
              <span key={k}
                className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-foreground/80 dark:text-white/80 backdrop-blur">
                {k}
                <button onClick={() => requestRemove(k)} className="opacity-50 group-hover:opacity-100 hover:text-[var(--brand-red)]">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </section>

        {/* Password modal */}
        {showPass && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={closePass}>
            <div className="w-full max-w-sm rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.04] dark:bg-white/[0.04] backdrop-blur-2xl p-6 shadow-2xl"
                 onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[var(--brand-green)]/15 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-[var(--brand-green)]" />
                </div>
                <div>
                  <h3 className="text-foreground font-semibold">Password required</h3>
                  <p className="text-muted-foreground text-xs">Enter password to modify keywords</p>
                </div>
              </div>
              <input
                type="password"
                autoFocus
                value={passInput}
                onChange={(e) => { setPassInput(e.target.value); setPassError(""); }}
                onKeyDown={(e) => e.key === "Enter" && submitPass()}
                placeholder="••••"
                className="w-full px-3 py-2.5 rounded-md bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-foreground outline-none focus:border-[var(--brand-green)]/60"
              />
              {passError && <p className="text-[var(--brand-red)] text-xs mt-2">{passError}</p>}
              <div className="flex gap-2 mt-4">
                <button onClick={closePass}
                  className="flex-1 px-3 py-2 rounded-md text-sm text-foreground/70 hover:bg-black/5 dark:hover:bg-white/5 transition">
                  Cancel
                </button>
                <button onClick={submitPass}
                  className="flex-1 px-3 py-2 rounded-md text-sm font-semibold bg-[var(--brand-green)] text-black hover:brightness-110 transition">
                  Unlock
                </button>
              </div>
            </div>
          </div>
        )}

        <p className="text-center text-muted-foreground text-sm mt-10">
          📌 Always review your content before posting
        </p>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.03] backdrop-blur-xl px-4 py-3 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center"
           style={{ backgroundColor: `color-mix(in oklab, ${color} 15%, transparent)`, color }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold leading-tight" style={{ color }}>{value}</p>
      </div>
    </div>
  );
}
