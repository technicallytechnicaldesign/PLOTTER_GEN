// Runs locally in a cancellable worker; no photo data is sent over the network.
import { prepare } from "./decoder-core.js";
import { readMarkless } from "./freegrid.js";
self.onmessage = ({ data: { image, taps, look } }) => {
  try {
    const I = prepare(image);
    const r = readMarkless(I, taps.map(p => p.map(v => v * I.scale)), look,
      { log: () => self.postMessage({ progress: "Reading candidate grids… this can take a minute." }) });
    self.postMessage({ result: { quad: r.quad.map(p => p.map(v => v / I.scale)),
      C: r.C, R: r.R, weak: r.weak, readings: r.readings.slice(0, 3) } });
  } catch (error) { self.postMessage({ error: error.message || String(error) }); }
};
