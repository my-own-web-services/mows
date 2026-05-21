import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Stub the lazy children so the dispatch test doesn't try to load shaka or
// three.js. The stubs render distinctive testids the assertions can match.
vi.mock(`./formats/imageViewer/ImageViewer`, () => ({
    default: ({ src }: { readonly src: string }) => (
        <div data-testid={`stub-image`}>{src}</div>
    )
}));
vi.mock(`./formats/image360Viewer/Image360Viewer`, () => ({
    default: ({ src }: { readonly src: string }) => (
        <div data-testid={`stub-image360`}>{src}</div>
    )
}));
vi.mock(`./formats/videoViewer/VideoViewer`, () => ({
    default: ({ src, mimeType }: { readonly src: string; readonly mimeType: string }) => (
        <div data-testid={`stub-video`}>
            {mimeType}::{src}
        </div>
    )
}));

import FileViewer from "./FileViewer";

describe(`FileViewer dispatch`, () => {
    it(`renders ImageViewer for image/* without is360`, async () => {
        render(
            <FileViewer name={`a.png`} mimeType={`image/png`} src={`/p.png`} />
        );
        await screen.findByTestId(`stub-image`);
        expect(screen.queryByTestId(`stub-image360`)).not.toBeInTheDocument();
        expect(screen.queryByTestId(`stub-video`)).not.toBeInTheDocument();
    });

    it(`renders Image360Viewer for image/* when is360 is true`, async () => {
        render(
            <FileViewer name={`pano.jpg`} mimeType={`image/jpeg`} src={`/p.jpg`} is360 />
        );
        await screen.findByTestId(`stub-image360`);
        expect(screen.queryByTestId(`stub-image`)).not.toBeInTheDocument();
        expect(screen.queryByTestId(`stub-video`)).not.toBeInTheDocument();
    });

    it(`renders VideoViewer for any video/* mime type`, async () => {
        render(
            <FileViewer name={`a.mp4`} mimeType={`video/mp4`} src={`/a.mp4`} />
        );
        const stub = await screen.findByTestId(`stub-video`);
        expect(stub).toHaveTextContent(`video/mp4::/a.mp4`);
    });

    it(`renders VideoViewer for DASH and HLS manifest mime types`, async () => {
        const { rerender } = render(
            <FileViewer
                name={`m.mpd`}
                mimeType={`application/dash+xml`}
                src={`/m.mpd`}
            />
        );
        await waitFor(() =>
            expect(screen.getByTestId(`stub-video`)).toHaveTextContent(`application/dash+xml`)
        );
        rerender(
            <FileViewer
                name={`m.m3u8`}
                mimeType={`application/vnd.apple.mpegurl`}
                src={`/m.m3u8`}
            />
        );
        await waitFor(() =>
            expect(screen.getByTestId(`stub-video`)).toHaveTextContent(
                `application/vnd.apple.mpegurl`
            )
        );
    });

    it(`falls back to the name when no viewer matches`, () => {
        render(<FileViewer name={`doc.pdf`} mimeType={`application/pdf`} src={`/d.pdf`} />);
        expect(screen.getByText(`doc.pdf`)).toBeInTheDocument();
        expect(screen.queryByTestId(`stub-video`)).not.toBeInTheDocument();
        expect(screen.queryByTestId(`stub-image`)).not.toBeInTheDocument();
    });

    it(`renders the explicit fallback when provided and nothing matches`, () => {
        render(
            <FileViewer
                name={`doc.pdf`}
                mimeType={`application/pdf`}
                src={`/d.pdf`}
                fallback={<span data-testid={`custom-fallback`}>custom</span>}
            />
        );
        expect(screen.getByTestId(`custom-fallback`)).toBeInTheDocument();
    });
});
