/**
 * The hot/cold scale.
 *
 * Its own file so it can be tested without pulling in React and the world-atlas
 * topology. The ramp is the part that keeps being wrong, so it needs to be
 * cheap to assert on.
 *
 * ## Why it is not one hue
 *
 * The first version was blue-to-red and read wrong: on a dark map a cold blue
 * guess was hard to tell from unguessed land, so far guesses looked like they
 * had not registered. The fix was a single red hue with the lightness and
 * saturation doing the work — and that was reported as indistinguishable twice,
 * because it is. Between two guesses 4,000 km apart it produced two reds a few
 * per cent apart in lightness, which nobody can read at a glance on a country
 * the size of Belgium.
 *
 * Hue is what the eye actually discriminates, so this is a proper thermal ramp:
 * violet, purple, magenta, crimson, red, orange, amber, white-hot. It is the
 * scale a thermal camera uses, for the same reason. Every guess is strongly
 * saturated and none of it is near `--land` (#2b3543, dark and desaturated), so
 * the original complaint stays fixed: nothing reads as unguessed.
 *
 * "Redder is hotter" still holds across the middle, where most guesses land.
 * Past red it goes orange and then white-hot, which is what heat does.
 */

/** A stop on the ramp: the heat it sits at, then r, g, b. */
type Stop = readonly [heat: number, r: number, g: number, b: number]

/**
 * Stops are unevenly spaced on purpose, because the heat scale is not linear in
 * distance and the guesses are not evenly spread either.
 *
 * `heatOf` puts everything within ~4,000 km above 0.6, which is where a game is
 * actually won or lost — a guess 1,400 km out and one 2,900 km out differ by
 * about 0.11 of heat and have to look clearly different. So the hot half gets
 * five stops and the cold half gets three: the other side of the world only has
 * to read as "cold", not as a precise distance.
 */
const RAMP: readonly Stop[] = [
  [0.0, 67, 56, 202], // indigo — the other side of the world
  [0.25, 147, 51, 234], // purple
  [0.45, 192, 38, 211], // fuchsia
  [0.6, 219, 39, 119], // pink
  [0.7, 220, 38, 38], // red
  [0.8, 249, 115, 22], // orange
  [0.88, 250, 170, 30], // amber
  [0.94, 253, 224, 71], // yellow
  [1.0, 255, 251, 235], // white-hot — only ever the answer itself
]

export function heatRgb(heat: number): readonly [number, number, number] {
  // A bare clamp lets NaN through, and NaN channels render as no fill at all —
  // a guess that silently does not appear, which is the worst failure here.
  const clamped = Number.isFinite(heat) ? Math.min(1, Math.max(0, heat)) : 0

  let lower: Stop = RAMP[0]!
  for (const stop of RAMP) if (stop[0] <= clamped) lower = stop
  const upper: Stop = RAMP.find((stop) => stop[0] >= clamped) ?? RAMP[RAMP.length - 1]!

  const span = upper[0] - lower[0]
  const t = span === 0 ? 0 : (clamped - lower[0]) / span
  return [
    Math.round(lower[1] + (upper[1] - lower[1]) * t),
    Math.round(lower[2] + (upper[2] - lower[2]) * t),
    Math.round(lower[3] + (upper[3] - lower[3]) * t),
  ]
}

export function heatColour(heat: number): string {
  const [r, g, b] = heatRgb(heat)
  return `rgb(${r} ${g} ${b})`
}
