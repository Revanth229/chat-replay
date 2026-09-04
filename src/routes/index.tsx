import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CartoonAvatar } from "@/components/CartoonAvatar";
import {
  conversations,
  datesFor,
  expressionFor,
  formatDate,
  type Conversation,
} from "@/lib/replay-data";
import { useReplay } from "@/lib/use-replay";

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
  const expression = current ? expressionFor(current.text) : "neutral";
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
    setConvoId(id);
    const next = datesFor(conversations.find((c) => c.id === id)!);
    setDate(next[next.length - 1]!);
  };

  const pickDate = (d: string) => {
    reset();
    setDate(d);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card/70 px-5 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-xl bg-primary font-display text-lg font-semibold text-primary-foreground">
            R
          </div>
          <div className="leading-tight">
            <p className="font-display text-lg font-semibold tracking-tight">Replay</p>
            <p className="text-xs text-muted-foreground">Chats you can watch and hear</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
          <span className="size-2 rounded-full bg-accent" />
          {playing ? "Playing" : "Ready"} · {formatDate(activeDate)}
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-card/50 p-3 md:flex">
          <p className="px-2 pb-2 font-display text-base font-semibold">Chats</p>
          {conversations.map((c) => {
            const last = c.messages[c.messages.length - 1]!;
            const active = c.id === convo.id;
            return (
              <button
                key={c.id}
                onClick={() => switchConvo(c.id)}
                className={`flex items-center gap-3 rounded-xl p-3 text-left transition-colors ${
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
                className={`rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors ${
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

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="shrink-0 px-5 pt-5">
            <h1 className="font-display text-2xl font-semibold tracking-tight">{convo.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Choose a day, then press play.</p>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 md:hidden">
              {dates.map((d) => (
                <button
                  key={d}
                  onClick={() => pickDate(d)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                    d === activeDate ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {formatDate(d)}
                </button>
              ))}
            </div>
          </div>

          <div className="relative min-h-0 flex-1">
            {/* Two animated characters remain visible behind the conversation. */}
            <div className="absolute inset-0 overflow-hidden bg-chat-wallpaper">
              <div className="absolute inset-x-0 top-4 flex items-end justify-center gap-3 sm:gap-16">
                  {stagePeople.map((p) => (
                    <div key={p.id} className="flex flex-col items-center">
                      <CartoonAvatar
                        person={p}
                        expression={speakerId === p.id ? expression : "neutral"}
                        speaking={speakerId === p.id}
                        mouthOpen={mouthOpen}
                        size={140}
                      />
                      <span className={`-mt-2 rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${speakerId === p.id ? "bg-primary text-primary-foreground" : "bg-card/90 text-foreground"}`}>{p.name}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* messages float over the stage */}
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
                        } ${isCurrent ? "scale-[1.02] shadow-xl shadow-primary/20" : ""}`}
                      >
                        {!mine && (
                          <p className="text-[11px] font-semibold text-primary">
                            {convo.people.find((p) => p.id === m.from)?.name}
                          </p>
                        )}
                        <p className="text-sm text-pretty">{m.text}</p>
                        <span
                          className={`text-[11px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                        >
                          {m.time}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* transport */}
          <div className="shrink-0 px-5 pb-5 pt-1">
            <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-4 rounded-2xl bg-card/85 p-3 ring-1 ring-border backdrop-blur-xl">
              <button
                onClick={() => (playing ? stop() : play(index + 1 >= dayMessages.length ? 0 : Math.max(0, index)))}
                aria-label={playing ? "Pause replay" : "Play replay"}
                className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-lg text-primary-foreground ring-2 ring-primary/25"
              >
                {playing ? "❚❚" : "▶"}
              </button>
              <button
                onClick={reset}
                className="shrink-0 rounded-full bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground"
              >
                Restart
              </button>
              <div className="min-w-[160px] flex-1">
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary transition-all"
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
                  className="mt-1.5 h-1.5 w-28 accent-primary"
                />
              </div>
              <button
                onClick={() => {
                  stop();
                  setVoiceOn((v) => !v);
                }}
                className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold ring-1 ${
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
