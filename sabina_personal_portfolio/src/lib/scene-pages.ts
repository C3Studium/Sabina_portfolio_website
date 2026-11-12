// Stránky, které jsou jedna obrazovka se 3D scénou: bez scrollu, bez patičky
// a posuvníku, bez úvodu (opony s logem). Kolečko a tah tam ovládají scénu.
// Čte _app (patička, posuvník) a Preloader (úvod).
const SCENE_PAGES = new Set(["/projects"]);

/** `pathname` z routeru Nextu (u dynamických cest vzor, ne skutečná adresa). */
export const isScenePage = (pathname: string | null | undefined) => SCENE_PAGES.has(pathname ?? "");
