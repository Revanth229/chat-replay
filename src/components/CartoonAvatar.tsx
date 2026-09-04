import type { Expression, Person } from "@/lib/replay-data";

type Props = {
  person: Person;
  expression: Expression;
  speaking: boolean;
  mouthOpen: boolean;
  size?: number;
};

/** A full-body, age-aware character with expression, lip and body animation. */
export function CartoonAvatar({ person, expression, speaking, mouthOpen, size = 150 }: Props) {
  const { age, gender, skin, hair } = person;
  const kid = age < 13;
  const senior = age >= 50;
  const eyeR = kid ? 6.5 : senior ? 3.6 : 4.5;
  const headR = kid ? 42 : 40;
  const browY = expression === "surprised" ? 40 : expression === "sad" ? 48 : 45;
  const browLift = expression === "surprised" ? 8 : expression === "sad" ? -3 : 4;
  const shirt = person.isMe ? "var(--color-primary)" : "var(--color-accent)";

  const mouth = (() => {
    if (mouthOpen && speaking) {
      return <ellipse cx="80" cy="78" rx={expression === "surprised" ? 8 : 11} ry={expression === "surprised" ? 10 : 7} fill="var(--avatar-mouth)" />;
    }
    if (expression === "sad") return <path d="M70 82 Q80 73 90 82" fill="none" stroke="var(--avatar-mouth)" strokeWidth="3.5" strokeLinecap="round" />;
    if (expression === "surprised") return <ellipse cx="80" cy="79" rx="6" ry="7" fill="var(--avatar-mouth)" />;
    if (expression === "happy" || expression === "love") return <path d="M68 74 Q80 88 92 74 Z" fill="var(--avatar-mouth)" />;
    return <path d="M71 78 Q80 82 89 78" fill="none" stroke="var(--avatar-mouth)" strokeWidth="3.5" strokeLinecap="round" />;
  })();

  const hairShape = kid ? (
    <path d="M48 47 Q54 17 80 17 Q106 17 112 47 Q100 31 80 31 Q60 31 48 47 Z" fill={hair} />
  ) : gender === "female" ? (
    <path d="M40 76 Q42 13 80 13 Q118 13 120 76 Q117 33 80 25 Q43 33 40 76 Z" fill={hair} />
  ) : (
    <path d="M44 43 Q50 17 80 17 Q110 17 116 43 Q108 27 80 27 Q52 27 44 43 Z" fill={hair} />
  );

  return (
    <svg
      viewBox="0 0 160 240"
      width={size}
      height={size * 1.5}
      aria-label={`${person.name}, ${expression}`}
      role="img"
      className={speaking ? "avatar-speaking" : "avatar-listening"}
    >
      <g className={speaking ? "avatar-body-active" : "avatar-body-idle"}>
        <ellipse cx="80" cy="226" rx={kid ? 42 : 50} ry="8" fill="var(--avatar-shadow)" />
        <path d={kid ? "M57 137 Q80 121 103 137 L111 192 H49 Z" : "M49 140 Q80 119 111 140 L121 198 H39 Z"} fill={shirt} />
        <rect x={kid ? 59 : 55} y="188" width="20" height={kid ? 27 : 35} rx="10" fill="var(--avatar-trousers)" />
        <rect x={kid ? 83 : 85} y="188" width="20" height={kid ? 27 : 35} rx="10" fill="var(--avatar-trousers)" />
        <g className={speaking ? "avatar-arm-wave" : ""}>
          <path d="M48 145 Q24 157 34 185" fill="none" stroke={shirt} strokeWidth="18" strokeLinecap="round" />
          <circle cx="35" cy="187" r="9" fill={skin} />
        </g>
        <path d="M112 145 Q136 157 126 185" fill="none" stroke={shirt} strokeWidth="18" strokeLinecap="round" />
        <circle cx="125" cy="187" r="9" fill={skin} />
        <rect x="72" y="112" width="16" height="24" rx="8" fill={skin} />
        <circle cx="80" cy="68" r={headR} fill={skin} />
        {hairShape}
        {(expression === "love" || !senior) && (
          <>
            <circle cx="58" cy="70" r={kid ? 8 : 6} fill="var(--color-primary)" opacity={expression === "love" ? 0.55 : 0.28} />
            <circle cx="102" cy="70" r={kid ? 8 : 6} fill="var(--color-primary)" opacity={expression === "love" ? 0.55 : 0.28} />
          </>
        )}
        <path d={`M62 ${browY} Q70 ${browY - browLift} 77 ${browY}`} fill="none" stroke="var(--color-foreground)" strokeWidth="3" strokeLinecap="round" />
        <path d={`M83 ${browY} Q90 ${browY - browLift} 98 ${browY}`} fill="none" stroke="var(--color-foreground)" strokeWidth="3" strokeLinecap="round" />
        <circle cx="68" cy="59" r={eyeR} fill="var(--color-foreground)" />
        <circle cx="92" cy="59" r={eyeR} fill="var(--color-foreground)" />
        {kid && <><circle cx="70" cy="57" r="2" fill="var(--avatar-eye-shine)" /><circle cx="94" cy="57" r="2" fill="var(--avatar-eye-shine)" /></>}
        {senior && <><circle cx="68" cy="59" r="11" fill="none" stroke="var(--color-foreground)" strokeWidth="2.2" opacity="0.7" /><circle cx="92" cy="59" r="11" fill="none" stroke="var(--color-foreground)" strokeWidth="2.2" opacity="0.7" /><path d="M79 59h2" stroke="var(--color-foreground)" strokeWidth="2.2" /></>}
        {mouth}
        {expression === "sad" && speaking && <path d="M62 68 Q57 77 62 80 Q67 77 62 68" fill="var(--avatar-tear)" />}
        {expression === "love" && speaking && <text x="112" y="45" fontSize="24">♥</text>}
      </g>
    </svg>
  );
}