export type Gender = "female" | "male";

export type Person = {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  skin: string;
  hair: string;
  isMe?: boolean;
};

export type Message = {
  id: string;
  from: string;
  text: string;
  /** ISO date, yyyy-mm-dd */
  date: string;
  time: string;
};

export type Conversation = {
  id: string;
  title: string;
  people: Person[];
  messages: Message[];
};

const me: Person = {
  id: "me",
  name: "You",
  age: 27,
  gender: "male",
  skin: "#f2c9a8",
  hair: "#3a2a20",
  isMe: true,
};

export const conversations: Conversation[] = [
  {
    id: "ana",
    title: "Ana Reyes",
    people: [
      { id: "ana", name: "Ana", age: 26, gender: "female", skin: "#ffd9c2", hair: "#7a5a44" },
      me,
    ],
    messages: [
      { id: "m1", from: "ana", text: "Hey! Did you catch the game last night?", date: "2026-08-12", time: "9:12 AM" },
      { id: "m2", from: "me", text: "No way. That final was insane 🤯", date: "2026-08-12", time: "9:13 AM" },
      { id: "m3", from: "ana", text: "Right?? I have been replaying it in my head all morning", date: "2026-08-12", time: "9:14 AM" },
      { id: "m4", from: "me", text: "We should watch the next one together 😄", date: "2026-08-12", time: "9:16 AM" },
      { id: "m5", from: "ana", text: "Okay I am literally crying rn 😭", date: "2026-08-12", time: "9:18 AM" },
      { id: "m6", from: "ana", text: "Good morning! Coffee before work?", date: "2026-08-20", time: "7:40 AM" },
      { id: "m7", from: "me", text: "Yes please. The usual place?", date: "2026-08-20", time: "7:42 AM" },
      { id: "m8", from: "ana", text: "See you in ten ☕", date: "2026-08-20", time: "7:43 AM" },
      { id: "m9", from: "me", text: "Did you finish the presentation?", date: "2026-09-02", time: "6:05 PM" },
      { id: "m10", from: "ana", text: "Almost! One slide left and I am so tired 😩", date: "2026-09-02", time: "6:11 PM" },
      { id: "m11", from: "me", text: "You got this. Send it over when you are done", date: "2026-09-02", time: "6:12 PM" },
    ],
  },
  {
    id: "family",
    title: "Family",
    people: [
      { id: "dad", name: "Dad", age: 58, gender: "male", skin: "#eec39a", hair: "#b9b3ad" },
      { id: "mom", name: "Mom", age: 55, gender: "female", skin: "#f6d0b4", hair: "#6b5147" },
      { id: "kid", name: "Riya", age: 9, gender: "female", skin: "#f7d9bf", hair: "#2f2320" },
      me,
    ],
    messages: [
      { id: "f1", from: "mom", text: "Dinner at seven tonight, everyone home please", date: "2026-08-12", time: "11:40 AM" },
      { id: "f2", from: "dad", text: "I will be back by six thirty", date: "2026-08-12", time: "11:44 AM" },
      { id: "f3", from: "kid", text: "Can we have ice cream after 🍦🍦", date: "2026-08-12", time: "11:45 AM" },
      { id: "f4", from: "me", text: "Only if you finish your homework 😄", date: "2026-08-12", time: "11:47 AM" },
      { id: "f5", from: "kid", text: "That is not fair 😭", date: "2026-08-12", time: "11:48 AM" },
      { id: "f6", from: "dad", text: "Landed safe. Call me when you can", date: "2026-08-28", time: "11:02 AM" },
      { id: "f7", from: "mom", text: "So happy you reached! Rest well ❤️", date: "2026-08-28", time: "11:09 AM" },
      { id: "f8", from: "me", text: "Calling you in five minutes", date: "2026-08-28", time: "11:10 AM" },
    ],
  },
];

export function datesFor(convo: Conversation): string[] {
  return Array.from(new Set(convo.messages.map((m) => m.date))).sort();
}

export function formatDate(iso: string): string {
  const parts = iso.split("-").map(Number);
  const [y, m, d] = [parts[0] ?? 2026, parts[1] ?? 1, parts[2] ?? 1];
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export type Expression = "happy" | "sad" | "surprised" | "neutral" | "love";

export function expressionFor(text: string): Expression {
  if (/😭|😩|😢|sad|tired|sorry/i.test(text)) return "sad";
  if (/🤯|😮|wow|insane|no way|\?\?/i.test(text)) return "surprised";
  if (/❤️|😍|love/i.test(text)) return "love";
  if (/😄|😀|🙂|😂|🍦|☕|happy|yes|great|good/i.test(text)) return "happy";
  return "neutral";
}

/** Strip emoji so the voice does not read symbol names. */
export function speakableText(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2764}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
