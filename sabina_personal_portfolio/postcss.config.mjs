// Vlastní PostCSS jen kvůli stropu obsahu 2K — viz postcss/viewport-frame.cjs.
// (Prefixy a minifikaci dál dělá Lightning CSS v Turbopacku.)
// Turbopack hledá pluginy jako moduly, relativní cesta mu nestačí — proto
// absolutní, od kořene projektu.
import path from "node:path";

const config = {
  plugins: {
    [path.join(process.cwd(), "postcss", "viewport-frame.cjs")]: {},
  },
};

export default config;
