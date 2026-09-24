export const PILLARS = [
  "GYM",
  "BUILD",
  "STUDY",
  "PRAY",
  "REFLECT",
  "LOVE",
  "FAMILY",
] as const;

export type Pillar = (typeof PILLARS)[number];
