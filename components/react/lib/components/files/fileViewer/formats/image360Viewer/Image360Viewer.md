# Image360Viewer

Equirectangular 360° panorama viewer. Thin React wrapper around
[`@photo-sphere-viewer/core`](https://photo-sphere-viewer.js.org/) (which
itself wraps three.js).

The component is heavy by web-app standards — three.js + photo-sphere-viewer
together are ~200 kB gzipped. `FileViewer` therefore imports it via
`React.lazy()`. If you render `Image360Viewer` directly, code-split it the
same way unless your route always wants the panorama renderer eagerly.

## Source images

Expects an **equirectangular projection** — a 2:1 image where `x` maps to
longitude (0–360°) and `y` maps to latitude (90° → −90°). Cubemaps and
other projections are not supported here; use the underlying
`@photo-sphere-viewer/core` directly if you need them.

For sharp rendering on a sphere you want at least ~4096 × 2048 — small
thumbnails wrapped on a sphere look unusably blurry. Consumers that talk to
a thumbnail API (e.g. filez) should request the largest pre-rendered tier
for 360 images regardless of container width.

## Props

| Prop                | Type                                    | Notes                                                                                                                                       |
| ------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `src`               | `string` (required)                     | Resolved URL to the equirectangular image. Data URLs are fine.                                                                              |
| `alt`               | `string`                                | Set as `aria-label` on the container.                                                                                                       |
| `navbar`            | `boolean \| string[]`                   | Photo Sphere Viewer navbar config. Defaults to `false` (no chrome).                                                                         |
| `defaultZoomLevel`    | `number`                                | Initial zoom level 0..100, where 0 maps to `maxFov` (widest) and 100 maps to `minFov` (tightest). Default keeps the FOV near PSV's stock 90°. |
| `minFov`            | `number`                                | Tightest allowed field of view, in degrees. Default `10`.                                                                                   |
| `maxFov`            | `number`                                | Widest allowed field of view, in degrees. Default `140`.                                                                                    |
| `onHeadingChange`   | `(degrees: number) => void`             | Fires on yaw change with bearing in 0..360 — drops straight into a `<Compass>` (no extra math).                                              |
| `markers`           | `ReadonlyArray<Image360ViewerMarker>`   | Hotspots / waypoints. Updating diff-replaces via `setMarkers`. **HTML markers + tooltip.content fields require pre-sanitised input** — see SECURITY-12. |
| `onMarkerClick`     | `(marker: Image360ViewerMarker) => void`| Fires for any marker interaction (click, tap). Receives the original marker config (cast `marker.data` to your waypoint shape).             |
| `smoothTransitions` | `boolean`                               | Enable PSV's post-drag inertial glide. Default `false` (snappy 1:1 pointer-to-yaw).                                                         |
| `className`         | `string`                                |                                                                                                                                             |
| `style`             | `CSSProperties`                         |                                                                                                                                             |

## Lifecycle

- `componentDidMount` constructs a single `Viewer` instance bound to a div ref.
- `componentDidUpdate` calls `setPanorama(src)` when `src` changes — the
  existing viewer instance is reused rather than torn down.
- `componentWillUnmount` calls `viewer.destroy()` and releases the reference.

## Notes

- Renders into a sized container; give the wrapping element an explicit width
  and height (the viewer fills `100%`).
- The viewer canvas needs WebGL. There is no fallback rendering path; if WebGL
  is unavailable the viewer surfaces its own error.
