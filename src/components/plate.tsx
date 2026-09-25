import type { PlateSpec } from "@/lib/domain/food-colors";

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A top-down plate drawn from a recipe's real ingredient colours. Same recipe,
 * same plate (seeded by id). Purely decorative.
 */
export function Plate({ spec, seed, size = 64, className }: { spec: PlateSpec; seed: string; size?: number; className?: string }) {
  const r = rng(hash(seed));
  const pieces: Array<{ x: number; y: number; rx: number; ry: number; rot: number; c: string }> = [];
  const colors = spec.pieces.length ? spec.pieces : [spec.base];
  const count = Math.min(11, Math.max(6, colors.length * 2 + 1));
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + r() * 0.9;
    const dist = 4 + r() * 17;
    pieces.push({
      x: 50 + Math.cos(ang) * dist,
      y: 50 + Math.sin(ang) * dist,
      rx: 6.5 + r() * 5,
      ry: 5 + r() * 4,
      rot: r() * 180,
      c: colors[i % colors.length],
    });
  }
  const herbs = spec.herbs.length
    ? Array.from({ length: 7 }, () => ({ x: 30 + r() * 40, y: 30 + r() * 40, rot: r() * 180, c: spec.herbs[Math.floor(r() * spec.herbs.length)] }))
    : [];
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden>
      <circle cx="50" cy="52" r="47" fill="#000" opacity=".08" />
      <circle cx="50" cy="50" r="47" fill="#fffdf8" />
      <circle cx="50" cy="50" r="47" fill="none" stroke="#e7dccb" strokeWidth="1.2" />
      <circle cx="50" cy="50" r="36" fill="none" stroke="#efe6d6" strokeWidth="1" />
      <circle cx="50" cy="50" r="31" fill={spec.base} />
      <circle cx="44" cy="43" r="17" fill="#fff" opacity=".12" />
      {pieces.map((p, i) => (
        <ellipse key={i} cx={p.x} cy={p.y} rx={p.rx} ry={p.ry} fill={p.c} transform={`rotate(${p.rot} ${p.x} ${p.y})`} stroke="#000" strokeOpacity=".06" strokeWidth=".6" />
      ))}
      {herbs.map((h, i) => (
        <path key={i} d={`M${h.x} ${h.y} l3 -1.2`} stroke={h.c} strokeWidth="1.8" strokeLinecap="round" transform={`rotate(${h.rot} ${h.x} ${h.y})`} />
      ))}
    </svg>
  );
}
