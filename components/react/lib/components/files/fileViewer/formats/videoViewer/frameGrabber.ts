import { type ThumbnailFrame } from "./types";

// Pre-render preview size. 160×90 (16:9) matches the SeekPreview's tile
// dimensions; sources with other aspect ratios are letterboxed by the
// canvas draw (we preserve aspect by computing dest rect).
const PREVIEW_WIDTH = 160;
const PREVIEW_HEIGHT = 90;

interface CacheEntry {
    readonly time: number;
    readonly url: string;
}

const CACHE_SIZE = 32;
// Allow a generous timeout — cold ranges on a slow connection can take
// several seconds to decode their first frame. Returning `null` on timeout
// means the next hover will retry instead of caching a stale frame.
const SEEK_TIMEOUT_MS = 4000;
// HTMLMediaElement.readyState ≥ HAVE_CURRENT_DATA means at least one frame
// is decoded and drawable.
const HAVE_CURRENT_DATA = 2;

/**
 * Captures preview frames from a video URL by mounting a hidden `<video>`
 * element, seeking it on demand, and drawing the current frame to a
 * `<canvas>`. The blob URLs are cached so repeated hovers over the same
 * region don't redo the work.
 *
 * Only suitable for progressive `video/*` sources where the browser can
 * load the file via a plain `src` attribute. DASH/HLS callers should use
 * Shaka's own `getThumbnails()` API via the surrounding `VideoViewer`.
 */
export class VideoFrameGrabber {
    private video: HTMLVideoElement | null = null;
    private host: HTMLDivElement | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;
    private metadataReady: Promise<void> | null = null;
    private duration = 0;
    private cache: CacheEntry[] = [];
    private destroyed = false;
    /** Serialises seek operations: only one in flight at a time so back-to-
     * back hover requests don't race on the shared `<video>` element. */
    private chain: Promise<unknown> = Promise.resolve();
    /** Latest time a caller has asked for. When a queued request reaches
     * the head of the chain and its time isn't this one anymore (the user
     * has dragged further), the seek is skipped — keeps drag-scrub from
     * crawling through every intermediate frame the cursor passed over. */
    private latestRequestedTime: number | null = null;

    constructor(private readonly src: string) {}

    private getCached = (time: number): string | null => {
        const found = this.cache.find((c) => Math.abs(c.time - time) < 0.4);
        return found ? found.url : null;
    };

    private addToCache = (time: number, url: string): void => {
        this.cache.push({ time, url });
        if (this.cache.length > CACHE_SIZE) {
            const evicted = this.cache.shift();
            if (evicted) URL.revokeObjectURL(evicted.url);
        }
    };

    private ensureVideo = (): HTMLVideoElement => {
        if (this.video) return this.video;
        const v = document.createElement(`video`);
        v.crossOrigin = `anonymous`;
        v.preload = `auto`;
        v.muted = true;
        v.playsInline = true;
        v.src = this.src;
        // Chrome (and other Chromium-based browsers) throttle media on
        // elements that aren't attached to the document — seek can hang,
        // the `seeked` event may never fire, and `drawImage` ends up
        // sampling a stale frame. Park the element off-screen in a
        // dedicated 1×1 container so the browser treats it as a real
        // player. `aria-hidden` keeps assistive tech from picking it up.
        const host = document.createElement(`div`);
        host.setAttribute(`aria-hidden`, `true`);
        Object.assign(host.style, {
            position: `fixed`,
            left: `-9999px`,
            top: `0`,
            width: `1px`,
            height: `1px`,
            overflow: `hidden`,
            pointerEvents: `none`,
            opacity: `0`
        } satisfies Partial<CSSStyleDeclaration>);
        host.appendChild(v);
        document.body.appendChild(host);
        this.host = host;
        this.video = v;
        this.canvas = document.createElement(`canvas`);
        this.canvas.width = PREVIEW_WIDTH;
        this.canvas.height = PREVIEW_HEIGHT;
        this.ctx = this.canvas.getContext(`2d`);
        this.metadataReady = new Promise((resolve, reject) => {
            const onLoaded = () => {
                this.duration = v.duration;
                v.removeEventListener(`loadedmetadata`, onLoaded);
                v.removeEventListener(`error`, onError);
                resolve();
            };
            const onError = () => {
                v.removeEventListener(`loadedmetadata`, onLoaded);
                v.removeEventListener(`error`, onError);
                reject(new Error(`frame grabber: video failed to load metadata`));
            };
            v.addEventListener(`loadedmetadata`, onLoaded);
            v.addEventListener(`error`, onError);
        });
        return v;
    };

    private seekAndGrab = async (time: number): Promise<string | null> => {
        const v = this.ensureVideo();
        if (!this.ctx || !this.canvas) return null;
        await this.metadataReady;
        if (this.destroyed) return null;
        const safeTime = Math.max(0, Math.min(this.duration - 0.05, time));
        // If the seek would be a no-op (we're already at this time and a
        // frame is decoded), short-circuit. Otherwise the `seeked` event
        // never fires.
        if (Math.abs(v.currentTime - safeTime) >= 0.05 || v.readyState < HAVE_CURRENT_DATA) {
            const seekResult = await new Promise<`seeked` | `timeout` | `error`>((resolve) => {
                const onSeeked = () => {
                    v.removeEventListener(`seeked`, onSeeked);
                    v.removeEventListener(`error`, onError);
                    clearTimeout(timer);
                    resolve(`seeked`);
                };
                const onError = () => {
                    v.removeEventListener(`seeked`, onSeeked);
                    v.removeEventListener(`error`, onError);
                    clearTimeout(timer);
                    resolve(`error`);
                };
                const timer = setTimeout(() => {
                    v.removeEventListener(`seeked`, onSeeked);
                    v.removeEventListener(`error`, onError);
                    resolve(`timeout`);
                }, SEEK_TIMEOUT_MS);
                v.addEventListener(`seeked`, onSeeked);
                v.addEventListener(`error`, onError);
                v.currentTime = safeTime;
            });
            if (seekResult !== `seeked`) return null;
        }
        if (this.destroyed) return null;
        const vw = v.videoWidth;
        const vh = v.videoHeight;
        if (!vw || !vh || v.readyState < HAVE_CURRENT_DATA) return null;
        // Letterbox: scale source to fit destination preserving aspect ratio.
        const scale = Math.min(PREVIEW_WIDTH / vw, PREVIEW_HEIGHT / vh);
        const dw = vw * scale;
        const dh = vh * scale;
        const dx = (PREVIEW_WIDTH - dw) / 2;
        const dy = (PREVIEW_HEIGHT - dh) / 2;
        this.ctx.fillStyle = `#000`;
        this.ctx.fillRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
        try {
            this.ctx.drawImage(v, 0, 0, vw, vh, dx, dy, dw, dh);
        } catch {
            // Some browsers throw `SecurityError` when the video came from a
            // CORS-less origin and the canvas would become tainted. Bail
            // gracefully — the SeekPreview falls back to timestamp-only.
            return null;
        }
        return new Promise<string | null>((resolve) => {
            this.canvas!.toBlob((blob) => {
                if (!blob) {
                    resolve(null);
                    return;
                }
                resolve(URL.createObjectURL(blob));
            }, `image/jpeg`, 0.7);
        });
    };

    private frameFor = (time: number, uri: string): ThumbnailFrame => ({
        uri,
        width: PREVIEW_WIDTH,
        height: PREVIEW_HEIGHT,
        sprite: false,
        positionX: 0,
        positionY: 0,
        imageWidth: PREVIEW_WIDTH,
        imageHeight: PREVIEW_HEIGHT,
        startTime: time,
        duration: 0
    });

    /** Returns a ThumbnailFrame pointing at a cached blob URL for the given
     * time, or null if the frame can't be produced (network error, CORS-
     * tainted canvas, superseded by a newer request, …). The blob URL is
     * owned by this grabber and will be revoked when evicted from the LRU
     * or on `destroy()`. */
    getThumbnail = async (time: number): Promise<ThumbnailFrame | null> => {
        if (this.destroyed) return null;
        // Cache hit: instant return regardless of in-flight work.
        const cached = this.getCached(time);
        if (cached) return this.frameFor(time, cached);
        // Mark this as the latest wanted time. Older queued requests will
        // notice they've been superseded and skip the actual seek instead
        // of crawling through every frame the cursor passed over.
        this.latestRequestedTime = time;
        const myTurn = this.chain.then(async (): Promise<string | null> => {
            if (this.destroyed) return null;
            // If a newer request has arrived while we were queued, drop
            // this one — the next chain entry will take care of the
            // up-to-date target.
            if (this.latestRequestedTime !== time) return null;
            // Clear so subsequent requests that come in during our seek
            // can claim the "latest" slot.
            this.latestRequestedTime = null;
            return this.seekAndGrab(time);
        });
        this.chain = myTurn.catch(() => null);
        try {
            const url = await myTurn;
            if (!url) return null;
            this.addToCache(time, url);
            return this.frameFor(time, url);
        } catch {
            return null;
        }
    };

    destroy = (): void => {
        this.destroyed = true;
        this.cache.forEach((c) => URL.revokeObjectURL(c.url));
        this.cache = [];
        if (this.video) {
            this.video.removeAttribute(`src`);
            this.video.load();
            this.video = null;
        }
        if (this.host && this.host.parentNode) {
            this.host.parentNode.removeChild(this.host);
        }
        this.host = null;
        this.canvas = null;
        this.ctx = null;
    };
}
