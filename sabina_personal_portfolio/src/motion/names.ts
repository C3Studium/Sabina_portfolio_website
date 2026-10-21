// Jméno stránky, které opona a závoj ukážou v okně.
//
// Vnořená cesta spadne na svou sekci (detail projektu se hlásí jako
// „Projekt"), neznámá dá null a scéna nápis vynechá.

const NAMES: { path: string; name: string; nested?: string }[] = [
  { path: "/", name: "Domů" },
  { path: "/about", name: "O mně" },
  { path: "/reviews", name: "Reference" },
  { path: "/projects", name: "Projekty", nested: "Projekt" },
];

export function nameFor(path: string): string | null {
  const exact = NAMES.find((entry) => entry.path === path);
  if (exact) return exact.name;
  const section = NAMES.find((entry) => entry.path !== "/" && path.startsWith(`${entry.path}/`));
  return section ? section.nested ?? section.name : null;
}
