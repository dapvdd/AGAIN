import { PILLARS } from "@/lib/pillars";

export function PillarList() {
  return (
    <ul className="flex flex-wrap gap-x-6 gap-y-3">
      {PILLARS.map((pillar) => (
        <li
          key={pillar}
          className="text-sm font-medium uppercase tracking-widest text-zinc-600 dark:text-zinc-400"
        >
          {pillar}
        </li>
      ))}
    </ul>
  );
}
