// Diagnostika do rohu: `?stats=1` v adrese. Snímky za sekundu, nejhorší
// snímek, takt displeje (odhad), dpr, počet pláten a WebGL kontextů, co
// o stroji soudí PerformanceProvider, prohlížeč. Pro hlášení z počítače,
// na který se nedá připojit (Mac, Safari) — čísla se dají opsat nebo vyfotit.
// Mimo `?stats=1` se nevykreslí nic.

import { useEffect, useState } from "react";
import { usePerformance } from "@/providers/PerformanceProvider";

type Row = { fps: number; worst: number; hz: number };

export default function Stats() {
  const [on, setOn] = useState(false);
  const [row, setRow] = useState<Row>({ fps: 0, worst: 0, hz: 0 });
  const [info, setInfo] = useState({ dpr: 1, canvases: 0, webgl: 0, ua: "", reduce: false });
  const perf = usePerformance();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- přepínač z adresy
    setOn(new URLSearchParams(window.location.search).has("stats"));
  }, []);

  useEffect(() => {
    if (!on) return undefined;
    let raf = 0;
    let frames = 0;
    let worst = 0;
    let best = Infinity;
    let last = performance.now();
    let since = last;
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      frames++;
      worst = Math.max(worst, dt);
      best = Math.min(best, dt);
      if (now - since >= 1000) {
        setRow({ fps: Math.round((frames * 1000) / (now - since)), worst: Math.round(worst), hz: best > 0 ? Math.round(1000 / best) : 0 });
        frames = 0;
        worst = 0;
        best = Infinity;
        since = now;
        const canvases = Array.from(document.querySelectorAll("canvas"));
        setInfo({
          dpr: window.devicePixelRatio,
          canvases: canvases.length,
          // Megapixely všech pláten dohromady — Safari má na plátna strop
          // paměti a nad ním je přestane kreslit přes GPU.
          webgl: Math.round(canvases.reduce((sum, c) => sum + c.width * c.height, 0) / 1e5) / 10,
          ua: navigator.userAgent.replace(/^Mozilla\/5\.0 \((.*?)\).*?(Version\/[\d.]+ )?(Safari|Chrome|Firefox)\/([\d.]+).*$/, "$1 · $3 $4"),
          reduce: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on]);

  if (!on) return null;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        left: 8,
        bottom: 8,
        zIndex: 99999,
        padding: "6px 9px",
        font: "11px/1.45 ui-monospace, Menlo, Consolas, monospace",
        color: "#e8e8e8",
        background: "rgba(0,0,0,0.72)",
        borderRadius: 6,
        pointerEvents: "none",
        whiteSpace: "pre",
      }}
    >
      {`fps ${row.fps} · worst ${row.worst} ms · display ~${row.hz} Hz\n` +
        `dpr ${info.dpr} · canvases ${info.canvases} · ${info.webgl} Mpx\n` +
        `cores ${navigator.hardwareConcurrency ?? "?"} · memory ${mem ?? "?"} · heavy ${perf.heavy ? "yes" : "NO"} · reduce ${info.reduce ? "ON" : "off"}\n` +
        info.ua}
    </div>
  );
}
