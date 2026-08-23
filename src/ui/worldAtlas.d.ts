/**
 * Declared rather than inferred. `resolveJsonModule` would otherwise hand
 * TypeScript a ten-megabyte object literal to infer a type for, which brings
 * the type checker to a crawl for no benefit.
 */
declare module 'world-atlas/countries-50m.json' {
  import type { Topology } from 'topojson-specification'
  const topology: Topology
  export default topology
}
