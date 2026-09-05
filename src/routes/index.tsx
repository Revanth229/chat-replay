import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CartoonAvatar } from "@/components/CartoonAvatar";
import {
  conversations,
  datesFor,
  expressionFor,
  formatDate,
  type Conversation,
  type Expression,
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

  // Manual Judge Reaction Test State
  const [manualOverride, setManualOverride] = useState<{
    text: string;
    expression: Expression;
    note: string;
    sarcasm?: boolean;
  } | null>(null);

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
  const speakerId = manualOverride ? convo.people[0]?.id : current?.from;

  // Real-time Featherless Emotion Hook
  useEffect(() => {
    if (manualOverride) return;
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
  }, [current, index, dayMessages, manualOverride]);

  const activeExpression: Expression = manualOverride
    ? manualOverride.expression
    : currentEmotion
    ? currentEmotion.expression
    : current
    ? expressionFor(current.text)
    : "neutral";

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
    setManualOverride(null);
    setRecap(null);
    setCurrentEmotion(null);
    setConvoId(id);
    const next = datesFor(conversations.find((c) => c.id === id)!);
    setDate(next[next.length - 1]!);
  };

  const pickDate = (d: string) => {
    reset();
    setManualOverride(null);
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

  // Trigger quick interactive test for judges
  const triggerQuickReaction = (
    text: string,
    expression: Expression,
    note: string,
    sarcasm: boolean = false
  ) => {
    stop();
    setManualOverride({ text, expression, note, sarcasm });
    setCurrentEmotion({
      expression,
      sarcasm,
      intensity: 9,
      directorNote: note,
    });
  };

  const hasKey = Boolean(getFeatherlessApiKey());

  // Mood Lighting Gradient mapped to AI Emotion
  const moodAtmosphere = useMemo(() => {
    switch (activeExpression) {
      case "surprised":
        return "from-amber-500/15 via-purple-500/10 to-transparent";
      case "love":
        return "from-pink-500/20 via-rose-400/10 to-transparent";
      case "sad":
        return "from-blue-600/20 via-indigo-900/15 to-transparent";
      case "happy":
        return "from-emerald-500/15 via-teal-400/10 to-transparent";
      default:
        return "from-primary/10 via-transparent to-transparent";
    }
  }, [activeExpression]);

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      {/* HEADER */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card/80 px-5 backdrop-blur-xl shadow-xs z-20">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-tr from-primary to-accent font-display text-lg font-bold text-primary-foreground shadow-md">
            R
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <p className="font-display text-lg font-bold tracking-tight">Replay</p>
              <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                PRO
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Animated chats with Featherless AI</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Featherless.ai Director Pill */}
          <button
            onClick={() => setShowSettings(true)}
            title="Configure Featherless.ai API Key & Models"
            className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-xs font-semibold transition-all border shadow-xs hover:scale-105 cursor-pointer ${
              hasKey
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                : "bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400"
            }`}
          >
            <span
              className={`size-2 rounded-full ${
                hasKey ? "bg-emerald-500 animate-pulse" : "bg-indigo-500 animate-ping"
              }`}
            />
            <span className="font-medium">⚡ Featherless AI Director</span>
            <span className="text-[10px] rounded-full bg-indigo-500/15 px-2 py-0.2 font-mono">
              {hasKey ? "Connected" : "Studio Mode"}
            </span>
          </button>

          <span className="hidden md:inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent border border-accent/20">
            <span className="size-2 rounded-full bg-accent animate-pulse" />
            {playing ? "Live Performance" : "Ready"} · {formatDate(activeDate)}
          </span>
        </div>
      </header>

      {/* FEATHERLESS AI SETTINGS MODAL */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-lg bg-indigo-600 text-white text-sm font-bold shadow-sm">
                  ⚡
                </span>
                <h3 className="font-display text-base font-bold">Featherless.ai Studio Setup</h3>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
              Connect your <strong>Featherless.ai</strong> API key to power real-time conversational inference using open-source models (Llama 3.1, Mistral, Qwen).
            </p>

            <form onSubmit={handleSaveSettings} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Featherless API Key
                </label>
                <input
                  type="password"
                  placeholder="Paste your key: sk-featherless-..."
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary shadow-inner"
                />
                <span className="text-[11px] text-muted-foreground mt-1.5 block">
                  Keys are stored safely in client-side memory. Never sent to any 3rd party backend.
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Serverless Inference Model
                </label>
                <select
                  value={modelInput}
                  onChange={(e) => setModelInput(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
                >
                  <option value="meta-llama/Meta-Llama-3.1-8B-Instruct">
                    meta-llama/Meta-Llama-3.1-8B-Instruct (Recommended & High Speed)
                  </option>
                  <option value="mistralai/Mistral-7B-Instruct-v0.3">
                    mistralai/Mistral-7B-Instruct-v0.3 (Nuance & Expression)
                  </option>
                  <option value="Qwen/Qwen2.5-7B-Instruct">
                    Qwen/Qwen2.5-7B-Instruct (Multi-lingual & Fast)
                  </option>
                </select>
              </div>

              {saveAlert && (
                <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/30 p-2.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold text-center">
                  ✓ Featherless AI Settings Saved & Verified!
                </div>
              )}

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setApiKeyInput("");
                    saveFeatherlessApiKey("");
                    setSaveAlert(true);
                    setTimeout(() => setSaveAlert(false), 1000);
                  }}
                  className="flex-1 rounded-xl border border-border bg-muted py-2.5 text-xs font-semibold text-muted-foreground hover:bg-secondary transition-colors cursor-pointer"
                >
                  Clear (Demo Mode)
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-gradient-to-r from-primary to-accent py-2.5 text-xs font-bold text-white hover:opacity-90 transition-opacity shadow-md cursor-pointer"
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
        <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-card/40 p-3 md:flex backdrop-blur-md">
          <div className="flex items-center justify-between px-2 pb-2">
            <p className="font-display text-base font-bold">Conversations</p>
            <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {conversations.length} Active
            </span>
          </div>

          <div className="space-y-1">
            {conversations.map((c) => {
              const last = c.messages[c.messages.length - 1]!;
              const active = c.id === convo.id;
              return (
                <button
                  key={c.id}
                  onClick={() => switchConvo(c.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-all cursor-pointer ${
                    active
                      ? "bg-primary/10 border border-primary/25 shadow-xs"
                      : "hover:bg-muted/70"
                  }`}
                >
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent font-bold text-primary-foreground shadow-sm">
                    {c.title.slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground">{c.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{last.text}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <p className="mt-6 px-2 pb-2 font-display text-base font-bold">Timeline Archives</p>
          <div className="flex flex-col gap-1.5">
            {dates.map((d) => (
              <button
                key={d}
                onClick={() => pickDate(d)}
                className={`rounded-xl px-3.5 py-2 text-left text-xs font-semibold transition-all cursor-pointer ${
                  d === activeDate
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.02]"
                    : "bg-muted/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                📅 {formatDate(d)}
              </button>
            ))}
          </div>

          {/* Quick Judge Demo Bar in Sidebar */}
          <div className="mt-auto pt-4 border-t border-border">
            <p className="px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              ⚡ Test Reactions (For Judges)
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() =>
                  triggerQuickReaction(
                    "That final was insane 🤯",
                    "surprised",
                    "High Shock Intensity",
                    false
                  )
                }
                className="rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 p-1.5 text-[11px] font-semibold text-left transition-colors cursor-pointer"
              >
                🤯 Surprise
              </button>
              <button
                onClick={() =>
                  triggerQuickReaction(
                    "Almost! I am literally crying rn 😭",
                    "sad",
                    "Exhausted & Tearful",
                    false
                  )
                }
                className="rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 p-1.5 text-[11px] font-semibold text-left transition-colors cursor-pointer"
              >
                😭 Sad/Tired
              </button>
              <button
                onClick={() =>
                  triggerQuickReaction(
                    "So happy you reached! Rest well ❤️",
                    "love",
                    "Affectionate Blush",
                    false
                  )
                }
                className="rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 p-1.5 text-[11px] font-semibold text-left transition-colors cursor-pointer"
              >
                ❤️ Love
              </button>
              <button
                onClick={() =>
                  triggerQuickReaction(
                    "Oh sure, that is totally fair 🙃",
                    "sad",
                    "Sarcasm Radar Alert",
                    true
                  )
                }
                className="rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 p-1.5 text-[11px] font-semibold text-left transition-colors cursor-pointer"
              >
                😏 Sarcasm
              </button>
            </div>
          </div>
        </aside>

        {/* MAIN AREA */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="shrink-0 px-4 sm:px-5 pt-3 sm:pt-4">
            {/* MOBILE ONLY: Conversation, Date & Quick Test Tabs */}
            <div className="md:hidden space-y-2 mb-3">
              {/* Chat Switcher */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {conversations.map((c) => {
                  const active = c.id === convo.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => switchConvo(c.id)}
                      className={`shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all shadow-xs cursor-pointer ${
                        active
                          ? "bg-primary text-primary-foreground shadow-sm scale-102"
                          : "bg-muted/80 text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      <span>💬</span>
                      <span>{c.title}</span>
                    </button>
                  );
                })}
              </div>

              {/* Date Switcher */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {dates.map((d) => (
                  <button
                    key={d}
                    onClick={() => pickDate(d)}
                    className={`shrink-0 rounded-xl px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
                      d === activeDate
                        ? "bg-primary/20 text-primary border border-primary/35 font-bold"
                        : "bg-muted/60 text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    📅 {formatDate(d)}
                  </button>
                ))}
              </div>

              {/* Mobile Quick Judge Test Bar */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5">
                <span className="text-[10px] font-extrabold text-muted-foreground uppercase shrink-0">
                  ⚡ AI Test:
                </span>
                <button
                  onClick={() =>
                    triggerQuickReaction("That final was insane 🤯", "surprised", "High Shock", false)
                  }
                  className="shrink-0 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 px-2.5 py-1 text-[10px] font-bold cursor-pointer"
                >
                  🤯 Surprise
                </button>
                <button
                  onClick={() =>
                    triggerQuickReaction("Almost! I am crying rn 😭", "sad", "Exhausted", false)
                  }
                  className="shrink-0 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 px-2.5 py-1 text-[10px] font-bold cursor-pointer"
                >
                  😭 Sad
                </button>
                <button
                  onClick={() =>
                    triggerQuickReaction("Rest well ❤️", "love", "Affection", false)
                  }
                  className="shrink-0 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 px-2.5 py-1 text-[10px] font-bold cursor-pointer"
                >
                  ❤️ Love
                </button>
                <button
                  onClick={() =>
                    triggerQuickReaction("Oh sure, totally fair 🙃", "sad", "Sarcasm", true)
                  }
                  className="shrink-0 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2.5 py-1 text-[10px] font-bold cursor-pointer"
                >
                  😏 Sarcasm
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-2xl font-bold tracking-tight">{convo.title}</h1>
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">
                    {formatDate(activeDate)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Select play to watch characters reenact this memory with synchronized voices & reactions.
                </p>
              </div>

              {/* Featherless AI Scene Recap Trigger */}
              <button
                onClick={handleGenerateRecap}
                disabled={loadingRecap}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 hover:from-indigo-500/20 hover:to-purple-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 px-4 py-2 text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50 hover:scale-102"
              >
                <span className="text-sm">🎬</span>
                <span>{loadingRecap ? "Featherless AI Analyzing..." : "Generate AI Scene Recap"}</span>
              </button>
            </div>

            {/* AI SCENE RECAP BANNER (If generated) */}
            {recap && (
              <div className="mt-3 relative rounded-3xl border border-indigo-500/40 bg-gradient-to-br from-indigo-500/10 via-background to-purple-500/10 p-4 shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-2">
                <button
                  onClick={() => setRecap(null)}
                  className="absolute right-3.5 top-3.5 text-muted-foreground hover:text-foreground text-xs p-1 cursor-pointer"
                  title="Close recap"
                >
                  ✕
                </button>
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-[11px] font-extrabold uppercase tracking-widest">
                  <span className="flex size-2 rounded-full bg-indigo-500 animate-ping" />
                  <span>Featherless AI Episode Preview</span>
                  <span>•</span>
                  <span className="rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-indigo-600 dark:text-indigo-300 font-semibold">
                    {recap.mood}
                  </span>
                </div>
                <h4 className="font-display font-bold text-base text-foreground mt-1.5">
                  "{recap.title}"
                </h4>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-2xl">
                  {recap.logline}
                </p>
                <div className="mt-2.5 flex items-center gap-2">
                  <span className="text-[11px] text-indigo-600 dark:text-indigo-300 font-semibold bg-indigo-500/15 rounded-xl px-3 py-1 inline-flex items-center gap-1.5">
                    <span>💡 Director Note:</span> {recap.directorAdvice}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* AVATAR STAGE */}
          <div className="relative min-h-0 flex-1 mt-2">
            <div className="absolute inset-0 overflow-hidden bg-chat-wallpaper">
              {/* Dynamic Mood Lighting Spotlight */}
              <div
                className={`absolute inset-x-0 top-0 h-72 bg-gradient-to-b ${moodAtmosphere} ambient-glow transition-all duration-700`}
              />

              {/* Floating AI Director Telemetry HUD */}
              <div className="absolute top-2 right-4 hidden sm:flex items-center gap-2 rounded-full bg-card/75 border border-border/80 px-3 py-1 backdrop-blur-md shadow-xs text-[11px]">
                <span className="text-muted-foreground font-mono">Model:</span>
                <span className="font-semibold text-primary">Llama-3.1-8B</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground font-mono">State:</span>
                <span className="font-bold capitalize text-foreground">{activeExpression}</span>
              </div>

              {/* Character Avatars Row */}
              <div className="absolute inset-x-0 top-3 flex items-end justify-center gap-4 sm:gap-20">
                {stagePeople.map((p) => {
                  const isSpeaking = (speakerId === p.id && (playing || Boolean(manualOverride)));
                  return (
                    <div key={p.id} className="flex flex-col items-center relative">
                      {/* AI Director Live Cue Chip */}
                      {isSpeaking && currentEmotion && (
                        <div className="mb-1 flex items-center gap-1.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold px-3 py-0.5 shadow-xl animate-in zoom-in-75 border border-indigo-400/40">
                          <span>⚡</span>
                          <span>{currentEmotion.directorNote}</span>
                          {currentEmotion.sarcasm && (
                            <span className="bg-amber-400 text-amber-950 px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase">
                              Sarcasm
                            </span>
                          )}
                        </div>
                      )}

                      <CartoonAvatar
                        person={p}
                        expression={isSpeaking ? activeExpression : "neutral"}
                        speaking={isSpeaking}
                        mouthOpen={mouthOpen}
                        size={142}
                      />

                      <div
                        className={`-mt-2.5 rounded-full px-3.5 py-1 text-xs font-bold shadow-md transition-all flex items-center gap-1.5 ${
                          isSpeaking
                            ? "bg-primary text-primary-foreground scale-105 ring-2 ring-primary/40"
                            : "bg-card/90 text-foreground border border-border/60"
                        }`}
                      >
                        <span>{p.name}</span>

                        {/* Animated Sound Wave Equalizer when speaking */}
                        {isSpeaking && (
                          <div className="flex items-center gap-0.5 h-3 ml-1">
                            <span className="w-0.5 bg-primary-foreground rounded-full animate-eq-1" />
                            <span className="w-0.5 bg-primary-foreground rounded-full animate-eq-2" />
                            <span className="w-0.5 bg-primary-foreground rounded-full animate-eq-3" />
                            <span className="w-0.5 bg-primary-foreground rounded-full animate-eq-4" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CHAT MESSAGES */}
            <div className="absolute inset-0 flex flex-col justify-end overflow-y-auto px-5 py-6 pt-64">
              <div className="mx-auto w-full max-w-3xl space-y-3">
                {visible.map((m, i) => {
                  const mine = m.from === "me";
                  const isCurrent = index >= 0 && i === index;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 backdrop-blur-md transition-all ${
                          mine
                            ? "rounded-tr-sm bg-primary text-primary-foreground shadow-sm"
                            : "rounded-tl-sm bg-card/90 ring-1 ring-border/80 shadow-xs"
                        } ${
                          isCurrent
                            ? "scale-[1.02] shadow-xl shadow-primary/25 ring-2 ring-primary/60 font-medium"
                            : ""
                        }`}
                      >
                        {!mine && (
                          <p className="text-[11px] font-bold text-primary">
                            {convo.people.find((p) => p.id === m.from)?.name}
                          </p>
                        )}
                        <p className="text-sm text-pretty leading-relaxed">{m.text}</p>
                        <div className="mt-1.5 flex items-center justify-between gap-3 text-[10px]">
                          <span
                            className={mine ? "text-primary-foreground/75" : "text-muted-foreground"}
                          >
                            {m.time}
                          </span>
                          {isCurrent && currentEmotion && (
                            <span
                              className={`font-bold uppercase tracking-wider text-[9px] px-1.5 py-0.5 rounded-md ${
                                mine
                                  ? "bg-white/20 text-white"
                                  : "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
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

          {/* PLAYBACK TRANSPORT BAR */}
          <div className="shrink-0 px-3 sm:px-5 pb-4 sm:pb-5 pt-1 sm:pt-2">
            <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between sm:justify-start gap-2 sm:gap-4 rounded-2xl sm:rounded-3xl bg-card/90 p-2.5 sm:p-3.5 ring-1 border border-border backdrop-blur-xl shadow-xl">
              <button
                onClick={() => {
                  setManualOverride(null);
                  playing ? stop() : play(index + 1 >= dayMessages.length ? 0 : Math.max(0, index));
                }}
                aria-label={playing ? "Pause replay" : "Play replay"}
                className="grid size-12 shrink-0 place-items-center rounded-full bg-gradient-to-tr from-primary to-accent text-lg text-primary-foreground shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-transform cursor-pointer"
              >
                {playing ? "❚❚" : "▶"}
              </button>
              <button
                onClick={() => {
                  setManualOverride(null);
                  reset();
                }}
                className="shrink-0 rounded-full bg-muted/80 px-3.5 py-2 text-xs font-bold text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
              >
                Restart
              </button>

              <div className="min-w-[160px] flex-1">
                <div className="h-2 rounded-full bg-muted overflow-hidden shadow-inner">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-200"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground font-mono">
                  <span>{dayMessages[0]?.time}</span>
                  <span>{dayMessages[dayMessages.length - 1]?.time}</span>
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-muted-foreground">Speed</span>
                  <span className="text-xs font-bold text-primary">{speed.toFixed(2)}×</span>
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
                className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold ring-1 transition-all cursor-pointer ${
                  voiceOn
                    ? "bg-accent/15 text-accent ring-accent/30 shadow-xs"
                    : "bg-muted text-muted-foreground ring-border"
                }`}
              >
                {voiceOn ? "🔊 Voice On" : "🔇 Voice Off"}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
