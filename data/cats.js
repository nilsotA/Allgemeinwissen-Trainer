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

/* Teilgebiete, die Lehrerwissen sind und kein Spieleabend-Wissen. Die Quizrunde
   ist die Simulation eines Quizspiels - und am Spieleabend fragt niemand nach der
   Ableitung von x hoch drei oder dem Doppelauftrag des Schulsports. Diese Karten
   bleiben im Tagestraining und in den Themenrunden voll dabei; nur der Pruefstand
   laesst sie aus, solange die Einstellung „Lehrerwissen in der Quizrunde" aus ist.
   Anatomie, Regelkunde, Mathegeschichte, Olympia bleiben drin: Die fragt ein Quiz. */
export const LEHRERWISSEN = {
  mat: new Set(['Grundlagen', 'Schulmathe', 'Analysis', 'Stochastik', 'Lineare Algebra', 'Mathedidaktik', 'Verfahren erkennen']),
  spo: new Set(['Sportdidaktik', 'Trainingslehre', 'Bewegungslehre', 'Sportpsychologie', 'Sportmedizin', 'Verfahren erkennen']),
};
