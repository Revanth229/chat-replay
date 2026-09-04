import { useCallback, useEffect, useRef, useState } from "react";
import type { Gender, Message, Person } from "./replay-data";
import { speakableText } from "./replay-data";

const FEMALE_HINTS = /female|woman|samantha|victoria|zira|karen|moira|tessa|fiona|susan|allison|ava|serena|google uk english female|google us english/i;
const MALE_HINTS = /male|man|daniel|alex|fred|david|george|thomas|oliver|rishi|google uk english male/i;

export function pickVoice(voices: SpeechSynthesisVoice[], gender: Gender, seed: number) {
  const en = voices.filter((v) => v.lang?.toLowerCase().startsWith("en"));
  const pool = en.length ? en : voices;
  const matched = pool.filter((v) =>
    gender === "female" ? FEMALE_HINTS.test(v.name) : MALE_HINTS.test(v.name),
  );
  const list = matched.length ? matched : pool;
  if (!list.length) return null;
  return list[seed % list.length] ?? null;
}

type Options = {
  messages: Message[];
  people: Person[];
  speed: number;
  voiceOn: boolean;
};

export function useReplay({ messages, people, speed, voiceOn }: Options) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [mouthOpen, setMouthOpen] = useState(false);
  const speedRef = useRef(speed);
  const voiceOnRef = useRef(voiceOn);
  const cancelled = useRef(false);
  const mouthTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  speedRef.current = speed;
  voiceOnRef.current = voiceOn;

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  const stopMouth = () => {
    if (mouthTimer.current) clearInterval(mouthTimer.current);
    mouthTimer.current = null;
    setMouthOpen(false);
  };

  const startMouth = useCallback(() => {
    stopMouth();
    mouthTimer.current = setInterval(() => setMouthOpen((m) => !m), Math.max(70, 150 / speedRef.current));
  }, []);

  const stop = useCallback(() => {
    cancelled.current = true;
    setPlaying(false);
    stopMouth();
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
  }, []);

  const speakOne = useCallback(
    (msg: Message) =>
      new Promise<void>((resolve) => {
        const person = people.find((p) => p.id === msg.from);
        const text = speakableText(msg.text);
        const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
        const fallbackMs = Math.max(900, (text.length * 60) / speedRef.current);

        if (!voiceOnRef.current || !synth || !text) {
          startMouth();
          const t = setTimeout(() => {
            stopMouth();
            resolve();
          }, fallbackMs);
          const check = setInterval(() => {
            if (cancelled.current) {
              clearTimeout(t);
              clearInterval(check);
              stopMouth();
              resolve();
            }
          }, 100);
          setTimeout(() => clearInterval(check), fallbackMs + 50);
          return;
        }

        const utter = new SpeechSynthesisUtterance(text);
        const seed = people.findIndex((p) => p.id === msg.from);
        const voice = pickVoice(synth.getVoices(), person?.gender ?? "female", Math.max(0, seed));
        if (voice) utter.voice = voice;
        utter.rate = Math.min(2, Math.max(0.5, speedRef.current));
        utter.pitch = person?.gender === "female" ? 1.25 : 0.85;
        if (person && person.age < 13) utter.pitch = 1.6;
        if (person && person.age >= 55) utter.pitch = person.gender === "female" ? 1.05 : 0.7;

        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          stopMouth();
          resolve();
        };
        utter.onstart = () => startMouth();
        utter.onboundary = () => setMouthOpen((m) => !m);
        utter.onend = finish;
        utter.onerror = finish;
        synth.cancel();
        synth.speak(utter);
        // Safety net if the engine never fires onend.
        setTimeout(finish, fallbackMs + 6000);
      }),
    [people, startMouth],
  );

  const play = useCallback(
    async (from = 0) => {
      cancelled.current = false;
      setPlaying(true);
      for (let i = from; i < messages.length; i++) {
        if (cancelled.current) break;
        const msg = messages[i];
        if (!msg) continue;
        setIndex(i);
        await speakOne(msg);
        if (cancelled.current) break;
        await new Promise((r) => setTimeout(r, 350 / speedRef.current));
      }
      if (!cancelled.current) setPlaying(false);
    },
    [messages, speakOne],
  );

  const reset = useCallback(() => {
    stop();
    setIndex(-1);
  }, [stop]);

  useEffect(() => reset, [reset]);

  return { index, playing, mouthOpen, play, stop, reset, setIndex, voices };
}
