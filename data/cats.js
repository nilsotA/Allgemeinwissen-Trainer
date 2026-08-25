export const CATS = [
  { id: "ges", name: "Geschichte",          icon: "🏛️" },
  { id: "geo", name: "Geografie",           icon: "🌍" },
  { id: "nat", name: "Natur & Technik",     icon: "🔬" },
  { id: "mat", name: "Mathematik",          icon: "📐" },
  { id: "spo", name: "Sport",               icon: "🏅" },
  { id: "kul", name: "Kunst & Unterhaltung", icon: "🎨" },
  { id: "spr", name: "Sprache & Literatur", icon: "📖" },
  { id: "pol", name: "Politik & Wirtschaft",icon: "⚖️" },
  { id: "all", name: "Alltag & Welt",       icon: "💡" }
];
export const CAT_BY_ID = Object.fromEntries(CATS.map(c => [c.id, c]));
export const LEVELS = {
  1: { name: "Basis",  hint: "Schulwissen Klasse 5–8" },
  2: { name: "Solide", hint: "gute Allgemeinbildung" },
  3: { name: "Profi",  hint: "Wissen, das den Unterschied macht" }
};
