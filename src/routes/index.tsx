import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CartoonAvatar } from "@/components/CartoonAvatar";
import {
  conversations,
  datesFor,
  expressionFor,
  formatDate,
  type Conversation,
} from "@/lib/replay-data";
import { useReplay } from "@/lib/use-replay";
import {
  analyzeEmotionWithFeatherless,
  generateSceneRecap,
  getFeatherlessApiKey,
  saveFeatherlessApiKey,
  getFeatherlessModel,
  saveFeatherlessModel,
  type EmotionAnalysis,
  type SceneRecap,
} from "@/lib/featherless";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Replay — Watch your old chats come alive" },
      {
        name: "description",
        content:
          "Pick a date, press play, and your past conversations replay with cartoon avatars that lip-sync, react with expressions, and speak in male or female voices at 0.5x to 2x speed.",
      },
      { property: "og:title", content: "Replay — Watch your old chats come alive" },
      {
        property: "og:description",
        content:
          "Pick a date, press play, and your past chats replay with lip-syncing cartoon avatars and adjustable voices.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReplayApp,
});

function ReplayApp() {
  const [convoId, setConvoId] = useState(conversations[0]!.id);
  const convo = conversations.find((c) => c.id === convoId) as Conversation;
  const dates = useMemo(() => datesFor(convo), [convo]);
  const [date, setDate] = useState(dates[dates.length - 1]!);
  const [speed, setSpeed] = useState(1);
  const [voiceOn, setVoiceOn] = useState(true);

  // Featherless AI Director States
  const [currentEmotion, setCurrentEmotion] = useState<EmotionAnalysis | null>(null);
  const [recap, setRecap] = useState<SceneRecap | null>(null);
  const [loadingRecap, setLoadingRecap] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(getFeatherlessApiKey());
  const [modelInput, setModelInput] = useState(getFeatherlessModel());
  const [saveAlert, setSaveAlert] = useState(false);

  const activeDate = dates.includes(date) ? date : dates[dates.length - 1]!;
  const dayMessages = useMemo(
    () => convo.messages.filter((m) => m.date === activeDate),
    [convo, activeDate],
  );

  const { index, playing, mouthOpen, play, stop, reset } = useReplay({
    messages: dayMessages,
    people: convo.people,
    speed,
    voiceOn,
  });

  const current = index >= 0 ? dayMessages[index] : undefined;
  const speakerId = current?.from;

  // Real-time Featherless Emotion Hook
  useEffect(() => {
    if (!current) {
      setCurrentEmotion(null);
      return;
    }
    let isCurrent = true;
    analyzeEmotionWithFeatherless(current, dayMessages.slice(0, index)).then((analysis) => {
      if (isCurrent) {
        setCurrentEmotion(analysis);
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [current, index, dayMessages]);

  const expression = currentEmotion ? currentEmotion.expression : current ? expressionFor(current.text) : "neutral";
  const visible = index >= 0 ? dayMessages.slice(0, index + 1) : dayMessages;
  const progress = dayMessages.length ? ((index + 1) / dayMessages.length) * 100 : 0;

  const stagePeople = useMemo(() => {
    const me = convo.people.find((person) => person.isMe);
    const currentPerson = current ? convo.people.find((person) => person.id === current.from) : undefined;
    const other = currentPerson?.isMe
      ? convo.people.find((person) => !person.isMe)
      : currentPerson ?? convo.people.find((person) => !person.isMe);
    return [other, me].filter((person): person is (typeof convo.people)[number] => Boolean(person));
  }, [convo, current]);

  const switchConvo = (id: string) => {
    reset();
    setRecap(null);
    setCurrentEmotion(null);
    setConvoId(id);
    const next = datesFor(conversations.find((c) => c.id === id)!);
    setDate(next[next.length - 1]!);
  };

  const pickDate = (d: string) => {
    reset();
    setRecap(null);
    setCurrentEmotion(null);
    setDate(d);
  };

  const handleGenerateRecap = async () => {
    setLoadingRecap(true);
    try {
      const res = await generateSceneRecap(convo.title, formatDate(activeDate), dayMessages);
      setRecap(res);
    } finally {
      setLoadingRecap(false);
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    saveFeatherlessApiKey(apiKeyInput);
    saveFeatherlessModel(modelInput);
    setSaveAlert(true);
    setTimeout(() => {
      setSaveAlert(false);
      setShowSettings(false);
    }, 1200);
  };

  const hasKey = Boolean(getFeatherlessApiKey());

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      {/* HEADER */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card/70 px-5 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-xl bg-primary font-display text-lg font-semibold text-primary-foreground shadow-sm">
            R
          </div>
          <div className="leading-tight">
            <p className="font-display text-lg font-semibold tracking-tight">Replay</p>
            <p className="text-xs text-muted-foreground">Chats you can watch and hear</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Featherless.ai Director Pill */}
          <button
            onClick={() => setShowSettings(true)}
            title="Configure Featherless.ai API Key & Models"
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition-all border shadow-xs hover:scale-105 cursor-pointer ${
              hasKey
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                : "bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400"
            }`}
          >
            <span
              className={`size-2 rounded-full ${
                hasKey ? "bg-emerald-500 animate-pulse" : "bg-indigo-500"
              }`}
            />
            <span>⚡ Featherless AI Director</span>
            <span className="text-[10px] opacity-75 font-mono">
              {hasKey ? "Active" : "Demo Mode"}
            </span>
          </button>

          <span className="hidden sm:inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
            <span className="size-2 rounded-full bg-accent" />
            {playing ? "Playing" : "Ready"} · {formatDate(activeDate)}
          </span>
        </div>
      </header>

      {/* FEATHERLESS AI SETTINGS MODAL */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚡</span>
                <h3 className="font-display text-base font-semibold">Featherless.ai Setup</h3>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground mt-3">
              Connect your <strong>Featherless.ai</strong> API key to unlock real-time contextual emotion analysis, sarcasm detection, and AI episodic summaries powered by open-source LLMs (Llama 3, Mistral).
            </p>

            <form onSubmit={handleSaveSettings} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Featherless API Key
                </label>
                <input
                  type="password"
                  placeholder="Paste your Featherless API Key (e.g. sk-featherless-...)"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
                />
                <span className="text-[11px] text-muted-foreground mt-1 block">
                  Keys are saved safely in your browser's local storage.
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  AI Model
                </label>
                <select
                  value={modelInput}
                  onChange={(e) => setModelInput(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
                >
                  <option value="meta-llama/Meta-Llama-3.1-8B-Instruct">
                    meta-llama/Meta-Llama-3.1-8B-Instruct (Recommended & Fast)
                  </option>
                  <option value="mistralai/Mistral-7B-Instruct-v0.3">
                    mistralai/Mistral-7B-Instruct-v0.3
                  </option>
                  <option value="Qwen/Qwen2.5-7B-Instruct">
                    Qwen/Qwen2.5-7B-Instruct
                  </option>
                </select>
              </div>

              {saveAlert && (
                <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/30 p-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold text-center">
                  ✓ Featherless AI Settings Saved!
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setApiKeyInput("");
                    saveFeatherlessApiKey("");
                    setSaveAlert(true);
                    setTimeout(() => setSaveAlert(false), 1000);
                  }}
                  className="flex-1 rounded-xl border border-border bg-muted py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary transition-colors cursor-pointer"
                >
                  Clear Key (Demo Mode)
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-primary py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity shadow-sm cursor-pointer"
                >
                  Save & Connect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* SIDEBAR */}
        <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-card/50 p-3 md:flex">
          <p className="px-2 pb-2 font-display text-base font-semibold">Chats</p>
          {conversations.map((c) => {
            const last = c.messages[c.messages.length - 1]!;
            const active = c.id === convo.id;
            return (
              <button
                key={c.id}
                onClick={() => switchConvo(c.id)}
                className={`flex items-center gap-3 rounded-xl p-3 text-left transition-colors cursor-pointer ${
                  active ? "bg-primary/10" : "hover:bg-muted"
                }`}
              >
                <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary font-semibold text-primary-foreground">
                  {c.title.slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{c.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{last.text}</p>
                </div>
              </button>
            );
          })}

          <p className="mt-5 px-2 pb-2 font-display text-base font-semibold">Pick a day</p>
          <div className="flex flex-col gap-1.5">
            {dates.map((d) => (
              <button
                key={d}
                onClick={() => pickDate(d)}
                className={`rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors cursor-pointer ${
                  d === activeDate
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                    : "bg-muted text-muted-foreground hover:bg-secondary"
                }`}
              >
                {formatDate(d)}
              </button>
            ))}
          </div>
        </aside>

        {/* MAIN AREA */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="shrink-0 px-5 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="font-display text-2xl font-semibold tracking-tight">{convo.title}</h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {formatDate(activeDate)} · Choose a day, then press play.
                </p>
              </div>

              {/* Featherless AI Scene Recap Trigger */}
              <button
                onClick={handleGenerateRecap}
                disabled={loadingRecap}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 px-3.5 py-1.5 text-xs font-semibold transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                <span>🎬</span>
                <span>{loadingRecap ? "AI Directing Scene..." : "AI Scene Recap (Featherless)"}</span>
              </button>
            </div>

            {/* AI SCENE RECAP BANNER (If generated) */}
            {recap && (
              <div className="mt-3 relative rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-4 animate-in fade-in slide-in-from-top-2">
                <button
                  onClick={() => setRecap(null)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground text-xs p-1 cursor-pointer"
                  title="Close recap"
                >
                  ✕
                </button>
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider">
                  <span>⚡ Featherless AI Director Recap</span>
                  <span>•</span>
                  <span className="text-muted-foreground font-medium">{recap.mood}</span>
                </div>
                <h4 className="font-display font-semibold text-sm text-foreground mt-1">
                  "{recap.title}"
                </h4>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {recap.logline}
                </p>
                <div className="mt-2 text-[11px] text-indigo-500/90 font-medium bg-indigo-500/10 rounded-lg px-2.5 py-1 inline-block">
                  <strong>Director's Cue:</strong> {recap.directorAdvice}
                </div>
              </div>
            )}

            {/* MOBILE DATES */}
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 md:hidden">
              {dates.map((d) => (
                <button
                  key={d}
                  onClick={() => pickDate(d)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                    d === activeDate ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {formatDate(d)}
                </button>
              ))}
            </div>
          </div>

          {/* AVATAR STAGE */}
          <div className="relative min-h-0 flex-1">
            <div className="absolute inset-0 overflow-hidden bg-chat-wallpaper">
              <div className="absolute inset-x-0 top-3 flex items-end justify-center gap-3 sm:gap-16">
                {stagePeople.map((p) => {
                  const isSpeaking = speakerId === p.id;
                  return (
                    <div key={p.id} className="flex flex-col items-center">
                      {/* AI Director Live Cue Chip */}
                      {isSpeaking && currentEmotion && (
                        <div className="mb-1 flex items-center gap-1.5 rounded-full bg-indigo-600 text-white text-[10px] font-semibold px-2.5 py-0.5 shadow-lg animate-in zoom-in-75">
                          <span>⚡</span>
                          <span>{currentEmotion.directorNote}</span>
                          {currentEmotion.sarcasm && (
                            <span className="bg-amber-400 text-amber-950 px-1.5 py-0.2 rounded-full text-[9px]">
                              Sarcasm
                            </span>
                          )}
                        </div>
                      )}

                      <CartoonAvatar
                        person={p}
                        expression={isSpeaking ? expression : "neutral"}
                        speaking={isSpeaking}
                        mouthOpen={mouthOpen}
                        size={140}
                      />
                      <span
                        className={`-mt-2 rounded-full px-3 py-1 text-xs font-semibold shadow-sm transition-all ${
                          isSpeaking
                            ? "bg-primary text-primary-foreground scale-105"
                            : "bg-card/90 text-foreground"
                        }`}
                      >
                        {p.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CHAT MESSAGES */}
            <div className="absolute inset-0 flex flex-col justify-end overflow-y-auto px-5 py-6 pt-64">
              <div className="mx-auto w-full max-w-3xl space-y-2.5">
                {visible.map((m, i) => {
                  const mine = m.from === "me";
                  const isCurrent = index >= 0 && i === index;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 backdrop-blur-md transition-all ${
                          mine
                            ? "rounded-tr-sm bg-primary text-primary-foreground"
                            : "rounded-tl-sm bg-card/90 ring-1 ring-border"
                        } ${isCurrent ? "scale-[1.02] shadow-xl shadow-primary/20 ring-2 ring-primary/40" : ""}`}
                      >
                        {!mine && (
                          <p className="text-[11px] font-semibold text-primary">
                            {convo.people.find((p) => p.id === m.from)?.name}
                          </p>
                        )}
                        <p className="text-sm text-pretty">{m.text}</p>
                        <div className="mt-1 flex items-center justify-between gap-3 text-[10px]">
                          <span
                            className={mine ? "text-primary-foreground/70" : "text-muted-foreground"}
                          >
                            {m.time}
                          </span>
                          {isCurrent && currentEmotion && (
                            <span
                              className={`font-semibold uppercase tracking-wider ${
                                mine ? "text-primary-foreground/90" : "text-indigo-500"
                              }`}
                            >
                              ⚡ {currentEmotion.expression}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* PLAYBACK BAR */}
          <div className="shrink-0 px-5 pb-5 pt-1">
            <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-4 rounded-2xl bg-card/85 p-3 ring-1 border border-border backdrop-blur-xl shadow-md">
              <button
                onClick={() =>
                  playing ? stop() : play(index + 1 >= dayMessages.length ? 0 : Math.max(0, index))
                }
                aria-label={playing ? "Pause replay" : "Play replay"}
                className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-lg text-primary-foreground ring-2 ring-primary/25 hover:scale-105 transition-transform cursor-pointer"
              >
                {playing ? "❚❚" : "▶"}
              </button>
              <button
                onClick={reset}
                className="shrink-0 rounded-full bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary transition-colors cursor-pointer"
              >
                Restart
              </button>
              <div className="min-w-[160px] flex-1">
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-primary transition-all duration-200"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                  <span>{dayMessages[0]?.time}</span>
                  <span>{dayMessages[dayMessages.length - 1]?.time}</span>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-muted-foreground">Speed</span>
                  <span className="text-xs font-semibold text-primary">{speed.toFixed(2)}×</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.25}
                  value={speed}
                  aria-label="Playback speed"
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="mt-1.5 h-1.5 w-28 accent-primary cursor-pointer"
                />
              </div>
              <button
                onClick={() => {
                  stop();
                  setVoiceOn((v) => !v);
                }}
                className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold ring-1 transition-colors cursor-pointer ${
                  voiceOn
                    ? "bg-accent/15 text-accent ring-accent/30"
                    : "bg-muted text-muted-foreground ring-border"
                }`}
              >
                {voiceOn ? "Voice on" : "Voice off"}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
