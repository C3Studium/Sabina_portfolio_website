// Dopsané texty umělé myši v Info a v úvodu Procesu — sdílené mezi
// komponentou, která text kreslí (TypeText `onDone`), a choreografií myši
// (info/choreography.ts), která do té doby čeká s textovým kurzorem.
// Úvod Procesu kreslí Process, ale myš řídí Info — proto modul, ne stav.

const done = new Set<string>();
const handlers = new Map<string, () => void>();

/** TypeText `onDone` pro klíč (stálá funkce). */
export const markTyped = (key: string) => {
  let handler = handlers.get(key);
  if (!handler) {
    handler = () => {
      done.add(key);
    };
    handlers.set(key, handler);
  }
  return handler;
};

export const isTyped = (key: string) => done.has(key);

/** Text se vrátil na zástupný (scroll zpět) — příště se zase čeká. */
export const resetTyped = (key: string) => {
  done.delete(key);
};
