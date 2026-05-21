import { Loader2 } from "lucide-react";
import { type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { formatTimestamp } from "./keyboard";
import { DEFAULT_STRINGS, type ThumbnailFrame, type VideoViewerStrings } from "./types";

// Tile dimensions for the rendered preview. Pinned to a 16:9 box so very
// wide sprite tiles don't blow out the bar; the inner thumbnail is letter-
// boxed via object-fit / background-size: contain semantics.
const PREVIEW_WIDTH = 160;
const PREVIEW_HEIGHT = 90;

export interface SeekPreviewProps {
    /** Time the user is hovering / dragging to, in seconds. */
    readonly time: number;
    /** Resolved thumbnail to show, or null when none is available. */
    readonly thumbnail: ThumbnailFrame | null;
    /** Whether the consumer is set up to deliver a thumbnail for this time
     * (a frame grabber is wired up or the manifest has image tracks). When
     * true we render an empty tile placeholder while `thumbnail` is null so
     * the user sees the tile follow the cursor even before the frame
     * arrives. When false the tile is omitted entirely. */
    readonly hasThumbnails?: boolean;
    /** Title of the chapter that covers `time`, or null when the source
     * has no chapters / the cursor is outside any chapter. */
    readonly chapterTitle?: string | null;
    /** Pointer x-position relative to the slider track (CSS px). */
    readonly trackX: number;
    /** Total width of the slider track (CSS px). Used to clamp the preview
     * so it never sits off-screen on either edge. */
    readonly trackWidth: number;
    /** Translated strings (aria labels). Falls back to English defaults. */
    readonly strings?: Partial<VideoViewerStrings>;
    readonly className?: string;
}

const thumbnailStyle = (thumb: ThumbnailFrame): CSSProperties => {
    if (!thumb.sprite) {
        // Single-image thumbnail: just an <img>-like background that fills
        // the tile via contain.
        return {
            backgroundImage: `url(${thumb.uri})`,
            backgroundRepeat: `no-repeat`,
            backgroundPosition: `center`,
            backgroundSize: `contain`,
            backgroundColor: `#000`
        };
    }
    // Sprite-sheet thumbnail. We render the *whole* sprite scaled so that the
    // tile (`thumb.width`×`thumb.height` at native sprite resolution) fits
    // into our `PREVIEW_WIDTH`×`PREVIEW_HEIGHT` box. Then `background-position`
    // shifts the sprite so the target tile sits at (0, 0).
    const scaleX = PREVIEW_WIDTH / thumb.width;
    const scaleY = PREVIEW_HEIGHT / thumb.height;
    return {
        backgroundImage: `url(${thumb.uri})`,
        backgroundRepeat: `no-repeat`,
        // Scaled sprite size = full sprite dimension × tile-to-preview scale.
        backgroundSize: `${thumb.imageWidth * scaleX}px ${thumb.imageHeight * scaleY}px`,
        // Negative offsets shift the sprite so the chosen tile lands at 0,0.
        backgroundPosition: `-${thumb.positionX * scaleX}px -${thumb.positionY * scaleY}px`,
        backgroundColor: `#000`
    };
};

const PADDING = 4;

export const SeekPreview = ({
    time,
    thumbnail,
    hasThumbnails = false,
    chapterTitle = null,
    trackX,
    trackWidth,
    strings,
    className
}: SeekPreviewProps) => {
    const t = { ...DEFAULT_STRINGS, ...strings };
    // Clamp the centred preview so it doesn't poke past either edge of the
    // slider — keeps the cursor and the preview vertically aligned without
    // letting the tile float into the page chrome on the left/right ends.
    const half = PREVIEW_WIDTH / 2;
    const min = half + PADDING;
    const max = Math.max(trackWidth - half - PADDING, min);
    const centerX = Math.min(Math.max(trackX, min), max);
    // Always show a tile when the consumer can produce thumbnails — even
    // before the frame for the current time loads. Without this the tile
    // would appear only for "settled" hover positions and the user would
    // see the timestamp pill float alone as they drag.
    const showTile = hasThumbnails || thumbnail !== null;
    return (
        <div
            role={`tooltip`}
            aria-label={`${t.seekTo} ${formatTimestamp(time)}`}
            className={cn(
                `pointer-events-none absolute -top-2 z-10 flex -translate-x-1/2 -translate-y-full flex-col items-center gap-1`,
                className
            )}
            style={{ left: `${centerX}px` }}
        >
            {showTile && (
                <div
                    aria-hidden
                    className={cn(
                        `relative flex items-center justify-center overflow-hidden rounded-md border border-white/20 bg-black shadow-lg`
                    )}
                    style={{
                        width: `${PREVIEW_WIDTH}px`,
                        height: `${PREVIEW_HEIGHT}px`,
                        ...(thumbnail ? thumbnailStyle(thumbnail) : {})
                    }}
                >
                    {!thumbnail && (
                        <Loader2 className={`h-5 w-5 animate-spin text-white/60`} />
                    )}
                </div>
            )}
            <span
                className={cn(
                    `flex max-w-[200px] items-center gap-1.5 rounded bg-black/85 px-1.5 py-0.5 text-xs font-medium text-white shadow`
                )}
            >
                {chapterTitle && (
                    <span
                        className={`truncate text-[11px] font-medium text-white/90`}
                        title={chapterTitle}
                    >
                        {chapterTitle}
                    </span>
                )}
                {chapterTitle && <span className={`text-white/40`}>·</span>}
                <span className={`tabular-nums`}>{formatTimestamp(time)}</span>
            </span>
        </div>
    );
};

export default SeekPreview;
