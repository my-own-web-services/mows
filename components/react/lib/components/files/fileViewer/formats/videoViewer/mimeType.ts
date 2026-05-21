// Manifest mime types Shaka handles natively. Listed explicitly because they
// don't share a single prefix and several server vendors use lowercase vs
// uppercase variants of the HLS playlist type.
export const STREAMING_MANIFEST_MIME_TYPES = new Set<string>([
    `application/dash+xml`,
    `application/vnd.apple.mpegurl`,
    `application/x-mpegurl`,
    `application/x-mpegURL`,
    `audio/mpegurl`,
    `audio/x-mpegurl`
]);

export const isVideoMimeType = (mimeType: string): boolean =>
    mimeType.startsWith(`video/`);

export const isStreamingManifestMimeType = (mimeType: string): boolean =>
    STREAMING_MANIFEST_MIME_TYPES.has(mimeType);

export const isVideoOrStream = (mimeType: string): boolean =>
    isVideoMimeType(mimeType) || isStreamingManifestMimeType(mimeType);
