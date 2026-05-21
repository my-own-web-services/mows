import { describe, expect, it } from "vitest";
import { isStreamingManifestMimeType, isVideoMimeType, isVideoOrStream } from "./mimeType";

describe(`isVideoMimeType`, () => {
    it(`matches any video/* mime type`, () => {
        expect(isVideoMimeType(`video/mp4`)).toBe(true);
        expect(isVideoMimeType(`video/webm`)).toBe(true);
        expect(isVideoMimeType(`video/ogg`)).toBe(true);
        expect(isVideoMimeType(`video/x-matroska`)).toBe(true);
        expect(isVideoMimeType(`video/quicktime`)).toBe(true);
    });
    it(`rejects non-video mime types`, () => {
        expect(isVideoMimeType(`image/png`)).toBe(false);
        expect(isVideoMimeType(`audio/mpeg`)).toBe(false);
        expect(isVideoMimeType(`application/pdf`)).toBe(false);
        expect(isVideoMimeType(`application/dash+xml`)).toBe(false);
    });
});

describe(`isStreamingManifestMimeType`, () => {
    it(`matches DASH manifests`, () => {
        expect(isStreamingManifestMimeType(`application/dash+xml`)).toBe(true);
    });
    it(`matches every HLS playlist variant in use`, () => {
        expect(isStreamingManifestMimeType(`application/vnd.apple.mpegurl`)).toBe(true);
        expect(isStreamingManifestMimeType(`application/x-mpegurl`)).toBe(true);
        expect(isStreamingManifestMimeType(`application/x-mpegURL`)).toBe(true);
        expect(isStreamingManifestMimeType(`audio/mpegurl`)).toBe(true);
        expect(isStreamingManifestMimeType(`audio/x-mpegurl`)).toBe(true);
    });
    it(`rejects plain video and non-streaming types`, () => {
        expect(isStreamingManifestMimeType(`video/mp4`)).toBe(false);
        expect(isStreamingManifestMimeType(`text/xml`)).toBe(false);
        expect(isStreamingManifestMimeType(`application/octet-stream`)).toBe(false);
    });
});

describe(`isVideoOrStream`, () => {
    it(`is true for video/* or any streaming manifest`, () => {
        expect(isVideoOrStream(`video/mp4`)).toBe(true);
        expect(isVideoOrStream(`video/webm`)).toBe(true);
        expect(isVideoOrStream(`application/dash+xml`)).toBe(true);
        expect(isVideoOrStream(`application/vnd.apple.mpegurl`)).toBe(true);
    });
    it(`is false for non-video, non-manifest types`, () => {
        expect(isVideoOrStream(`image/png`)).toBe(false);
        expect(isVideoOrStream(`application/pdf`)).toBe(false);
        expect(isVideoOrStream(`text/plain`)).toBe(false);
    });
});
