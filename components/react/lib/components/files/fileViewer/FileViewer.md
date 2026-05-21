# FileViewer

Generic file-preview surface. Dispatches on MIME type and renders the matching
format viewer; falls back to the file name (or a custom `fallback`) when no
viewer matches.

URL resolution is **not** the FileViewer's job — the consumer is expected to
have a resolved `src` URL already. App-specific resolvers (e.g. filez's
size-tier-aware URL builder) live in their own thin wrapper components.

## Dispatch table

| Condition                                  | Renders               |
| ------------------------------------------ | --------------------- |
| `mimeType.startsWith("image/") && is360`                                                                        | `Image360Viewer`      |
| `mimeType.startsWith("image/")`                                                                                 | `ImageViewer`         |
| `video/*` &nbsp;OR&nbsp; `application/dash+xml` &nbsp;OR&nbsp; `application/x-mpegURL` &nbsp;OR&nbsp; `application/vnd.apple.mpegurl` | `VideoViewer`         |
| anything else                                                                                                   | `fallback` or `name`  |

The video branch is gated by `isVideoOrStream(mimeType)` (exported from
`formats/videoViewer/mimeType.ts`), which is the canonical match list for
the row above — every `video/*` mime type plus the three streaming-manifest
mime types listed.

Both the `Image360Viewer` and `VideoViewer` branches are **lazy**. three.js +
photo-sphere-viewer (~200 kB gzip) are only fetched when `is360` is first
true; shaka-player (~256 kB gzip) is only fetched when a video or streaming
manifest is first viewed. Wrap callers in a `Suspense`-aware ancestor if you
need a non-blank loading state during those fetches; the component itself
uses an internal `Suspense` with an empty fallback.

## Props

| Prop        | Type                                   | Notes                                                              |
| ----------- | -------------------------------------- | ------------------------------------------------------------------ |
| `src`       | `string` (required)                    | Resolved URL. Data URLs are fine.                                  |
| `name`      | `string` (required)                    | Used as alt text and as the default fallback content.              |
| `mimeType`  | `string` (required)                    | Drives dispatch. `image/jpeg`, `image/avif`, etc.                  |
| `is360`     | `boolean`                              | Forces the `Image360Viewer` branch. Consumer detects (tags, GPano). |
| `width`     | `number`                               | Forwarded to format viewers that pick a thumbnail tier by width.    |
| `height`    | `number`                               | Forwarded to format viewers.                                       |
| `fallback`  | `ReactNode`                            | Rendered when no format viewer matches the MIME type.              |
| `className` | `string`                               |                                                                    |
| `style`     | `CSSProperties`                        |                                                                    |

## Adding a new format

1. Add either:
   - a `formats/<Name>.tsx` (for simple viewers — see `ImageViewer.tsx`,
     `Image360Viewer.tsx`), **or**
   - a `formats/<Name>.tsx` PLUS a `formats/<name>/` folder for helpers
     (mimetype detection, control bars, keyboard handlers, decoder
     modules, frame grabbers, etc.) — see `VideoViewer.tsx` and
     `formats/videoViewer/` for the helper-folder pattern.

   Keep the top-level viewer self-contained: takes a `src` plus
   format-specific props, no app context.
2. Add a branch to `FileViewer.tsx` that selects it for the appropriate MIME
   range. Use `React.lazy(() => import("./formats/<Name>"))` if the
   underlying library is heavy enough that consumers shouldn't pay for it
   unless they hit that branch.
3. Export the new viewer from `lib/main.ts` so apps that want to render it
   directly (bypassing the dispatch) can.
