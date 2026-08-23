import { useCallback, useRef, useState } from 'react'

export type Transform = { readonly k: number; readonly x: number; readonly y: number }

const IDENTITY: Transform = { k: 1, x: 0, y: 0 }
const MAX_ZOOM = 14

type Point = { x: number; y: number }
type View = { left: number; top: number; right: number; bottom: number }

/**
 * Pinch-and-drag zoom for an SVG, in viewBox units.
 *
 * The map has to zoom without the page zooming with it, which rules out
 * leaving it to the browser: the element takes the pointer events itself and
 * `touch-action: none` stops a phone treating a pinch as a page gesture.
 */
export function useZoomPan(width: number, height: number) {
  const [transform, setTransform] = useState<Transform>(IDENTITY)
  const [moved, setMoved] = useState(false)
  const surface = useRef<SVGSVGElement>(null)
  const pointers = useRef(new Map<number, Point>())

  /**
   * The slice of the viewBox actually on screen. Read from the element's own
   * matrix rather than worked out by hand, because `preserveAspectRatio` crops
   * the map on a narrow phone and only the browser knows by how much.
   */
  const view = useCallback((): View => {
    const svg = surface.current
    const matrix = svg?.getScreenCTM()
    const box = svg?.getBoundingClientRect()
    if (!svg || !matrix || !box) return { left: 0, top: 0, right: width, bottom: height }

    const inverse = matrix.inverse()
    const topLeft = new DOMPoint(box.left, box.top).matrixTransform(inverse)
    const bottomRight = new DOMPoint(box.right, box.bottom).matrixTransform(inverse)
    return { left: topLeft.x, top: topLeft.y, right: bottomRight.x, bottom: bottomRight.y }
  }, [width, height])

  /** Client pixels to viewBox units. */
  const toViewBox = useCallback((clientX: number, clientY: number): Point => {
    const matrix = surface.current?.getScreenCTM()
    if (!matrix) return { x: 0, y: 0 }
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse())
    return { x: point.x, y: point.y }
  }, [])

  /**
   * Keeps the map covering the screen, or centred once it is small enough to
   * fit entirely — so it can never be flung off into the corner.
   */
  const clamp = useCallback(
    (next: Transform): Transform => {
      const v = view()
      const spanX = v.right - v.left
      const spanY = v.bottom - v.top
      // Zooming out stops when the whole map is visible.
      const smallest = Math.min(spanX / width, spanY / height)
      const k = Math.min(MAX_ZOOM, Math.max(smallest, next.k))

      const axis = (value: number, span: number, near: number, far: number, extent: number) =>
        k * extent <= span ? (near + far - k * extent) / 2 : Math.min(near, Math.max(far - k * extent, value))

      return {
        k,
        x: axis(next.x, spanX, v.left, v.right, width),
        y: axis(next.y, spanY, v.top, v.bottom, height),
      }
    },
    [view, width, height],
  )

  /** Zoom about a fixed point, so whatever is under the fingers stays under them. */
  const zoomAt = useCallback(
    (focus: Point, factor: number) => {
      setTransform((current) => {
        const k = Math.min(MAX_ZOOM, current.k * factor)
        const scale = k / current.k
        return clamp({ k, x: focus.x - (focus.x - current.x) * scale, y: focus.y - (focus.y - current.y) * scale })
      })
    },
    [clamp],
  )

  /** Put a viewBox point in the middle of whatever is on screen. */
  const centreOn = useCallback(
    (point: Point, zoom = 1) => {
      const v = view()
      const middle = { x: (v.left + v.right) / 2, y: (v.top + v.bottom) / 2 }
      setTransform(clamp({ k: zoom, x: middle.x - zoom * point.x, y: middle.y - zoom * point.y }))
    },
    [view, clamp],
  )

  const reset = useCallback(() => {
    setTransform(clamp({ k: 0, x: 0, y: 0 }))
    setMoved(false)
  }, [clamp])

  const spread = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // A pointer that has already been released cannot be captured; panning
      // still works from the events we do get.
    }
    pointers.current.set(event.pointerId, toViewBox(event.clientX, event.clientY))
  }

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const previous = pointers.current.get(event.pointerId)
    if (!previous) return

    const next = toViewBox(event.clientX, event.clientY)
    const others = [...pointers.current.entries()].filter(([id]) => id !== event.pointerId)
    pointers.current.set(event.pointerId, next)
    setMoved(true)

    if (others.length === 0) {
      setTransform((current) =>
        clamp({ ...current, x: current.x + (next.x - previous.x), y: current.y + (next.y - previous.y) }),
      )
      return
    }

    // Two fingers: the change in their separation is the zoom.
    const anchor = others[0]![1]
    const before = spread(previous, anchor)
    const after = spread(next, anchor)
    if (before > 0) {
      zoomAt({ x: (next.x + anchor.x) / 2, y: (next.y + anchor.y) / 2 }, after / before)
    }
  }

  const onPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(event.pointerId)
  }

  const onWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    setMoved(true)
    zoomAt(toViewBox(event.clientX, event.clientY), Math.pow(0.999, event.deltaY))
  }

  return {
    transform,
    reset,
    centreOn,
    /** True once the player has moved the map from where it started. */
    moved,
    surfaceProps: {
      ref: surface,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onWheel,
      style: { touchAction: 'none' as const },
    },
  }
}
