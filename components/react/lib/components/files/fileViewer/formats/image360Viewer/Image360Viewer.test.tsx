import "@testing-library/jest-dom/vitest";
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock @photo-sphere-viewer/core: jsdom has no WebGL context, so the real
// Viewer can't initialise. The mock records its constructor + setOption
// calls so we can verify <Image360Viewer> drives the correct config.
interface ViewerMock {
    config: unknown;
    addedListeners: string[];
    listenerFns: Map<string, (event: unknown) => void>;
    setPanoramaCalls: { src: string; options: unknown }[];
    pendingSetPanorama: { resolve: () => void; reject: (e: unknown) => void } | null;
    fire(name: string, event: unknown): void;
}

const viewerInstances: ViewerMock[] = [];

vi.mock(`@photo-sphere-viewer/core`, () => {
    class Viewer implements ViewerMock {
        config: unknown;
        addedListeners: string[] = [];
        listenerFns: Map<string, (event: unknown) => void> = new Map();
        setPanoramaCalls: { src: string; options: unknown }[] = [];
        pendingSetPanorama:
            | { resolve: () => void; reject: (e: unknown) => void }
            | null = null;
        constructor(config: unknown) {
            this.config = config;
            viewerInstances.push(this);
        }
        addEventListener(name: string, fn: (event: unknown) => void): void {
            this.addedListeners.push(name);
            this.listenerFns.set(name, fn);
        }
        removeEventListener(): void {}
        destroy(): void {}
        setOption(): void {}
        setPanorama(src: string, options: unknown): Promise<void> {
            this.setPanoramaCalls.push({ src, options });
            return new Promise<void>((resolve, reject) => {
                this.pendingSetPanorama = { resolve, reject };
            });
        }
        getPlugin(): unknown {
            return null;
        }
        fire(name: string, event: unknown): void {
            this.listenerFns.get(name)?.(event);
        }
    }
    // The markers-plugin transitively imports TypedEvent / AbstractPlugin
    // from core for its event class hierarchy; stub them so the plugin's
    // module evaluates under jsdom without exercising real WebGL code.
    class TypedEvent extends Event {}
    class AbstractPlugin {}
    class AbstractConfigurablePlugin {}
    return { Viewer, TypedEvent, AbstractPlugin, AbstractConfigurablePlugin };
});

vi.mock(`@photo-sphere-viewer/core/index.css`, () => ({}));

vi.mock(`@photo-sphere-viewer/markers-plugin`, () => ({
    MarkersPlugin: class {}
}));
vi.mock(`@photo-sphere-viewer/markers-plugin/index.css`, () => ({}));

import Image360Viewer from "./Image360Viewer";

describe(`Image360Viewer`, () => {
    it(`mounts a Photo Sphere Viewer with the given src`, () => {
        viewerInstances.length = 0;
        render(<Image360Viewer src={`/pano.jpg`} />);
        expect(viewerInstances).toHaveLength(1);
        const cfg = viewerInstances[0]!.config as { panorama: string };
        expect(cfg.panorama).toBe(`/pano.jpg`);
    });

    it(`subscribes to PSV "position-updated" to forward heading changes`, () => {
        viewerInstances.length = 0;
        render(<Image360Viewer src={`/pano.jpg`} onHeadingChange={() => undefined} />);
        expect(viewerInstances[0]!.addedListeners).toContain(`position-updated`);
    });

    it(`renders no loading indicator while the panorama loads`, () => {
        viewerInstances.length = 0;
        const { container } = render(<Image360Viewer src={`/pano.jpg`} />);
        // No Skeleton shimmer overlay.
        expect(container.querySelector(`.animate-pulse`)).toBeNull();
        // The component does not branch on PSV's `ready` / `panorama-error`
        // events because there is no UI to toggle. (`panorama-loaded` IS
        // subscribed — see the heading-offset test below — but that
        // subscription drives metadata reading, not loading-state UI.)
        const listeners = viewerInstances[0]!.addedListeners;
        expect(listeners).not.toContain(`ready`);
        expect(listeners).not.toContain(`panorama-error`);
    });

    it(`reads GPano poseHeading from XMP metadata and shifts emitted bearings`, () => {
        viewerInstances.length = 0;
        const onHeadingChange = vi.fn<(deg: number) => void>();
        render(
            <Image360Viewer src={`/pano.jpg`} onHeadingChange={onHeadingChange} />
        );
        const inst = viewerInstances[0]!;
        expect(inst.addedListeners).toContain(`panorama-loaded`);
        expect(inst.addedListeners).toContain(`position-updated`);

        // Seed a pose heading via the XMP-equivalent payload PSV emits on
        // `panorama-loaded`, then fire a `position-updated` at yaw 0. The
        // component must add the pose offset onto raw yaw before emitting.
        inst.fire(`panorama-loaded`, { data: { panoData: { poseHeading: 90 } } });
        inst.fire(`position-updated`, { position: { yaw: 0, pitch: 0 } });
        expect(onHeadingChange).toHaveBeenLastCalledWith(90);

        // A panorama without pose metadata resets the offset back to 0 so
        // scene swaps don't leak the previous panorama's heading offset.
        inst.fire(`panorama-loaded`, { data: { panoData: {} } });
        inst.fire(`position-updated`, { position: { yaw: 0, pitch: 0 } });
        expect(onHeadingChange).toHaveBeenLastCalledWith(0);
    });

    it(`shows a Skeleton overlay during a hard-cut src swap and clears it when setPanorama resolves`, async () => {
        viewerInstances.length = 0;
        const { container, rerender } = render(<Image360Viewer src={`/pano.jpg`} />);
        // Initial mount: no Skeleton.
        expect(container.querySelector(`.animate-pulse`)).toBeNull();

        rerender(<Image360Viewer src={`/other.jpg`} />);

        // The hard-cut Skeleton appears immediately on the swap.
        expect(container.querySelector(`.animate-pulse`)).not.toBeNull();

        // PSV is told to skip its crossfade (transition: false) and to
        // keep its own loader suppressed — we're driving the visual.
        const inst = viewerInstances[0]!;
        expect(inst.setPanoramaCalls).toHaveLength(1);
        expect(inst.setPanoramaCalls[0]!.src).toBe(`/other.jpg`);
        expect(inst.setPanoramaCalls[0]!.options).toEqual({
            transition: false,
            showLoader: false
        });

        // Resolving the new texture clears the overlay.
        inst.pendingSetPanorama!.resolve();
        await Promise.resolve();
        await Promise.resolve();
        expect(container.querySelector(`.animate-pulse`)).toBeNull();
    });

    it(`crossfadeOnSwitch=true skips the Skeleton and asks PSV to crossfade`, () => {
        viewerInstances.length = 0;
        const { container, rerender } = render(
            <Image360Viewer src={`/pano.jpg`} crossfadeOnSwitch />
        );
        rerender(<Image360Viewer src={`/other.jpg`} crossfadeOnSwitch />);
        // No Skeleton — the user opted into PSV's stock blend.
        expect(container.querySelector(`.animate-pulse`)).toBeNull();
        const inst = viewerInstances[0]!;
        expect(inst.setPanoramaCalls[0]!.options).toEqual({
            transition: true,
            showLoader: false
        });
    });

    it(`forwards className onto the outer wrapper`, () => {
        viewerInstances.length = 0;
        const { container } = render(
            <Image360Viewer src={`/pano.jpg`} className={`my-viewer`} />
        );
        const root = container.firstChild as HTMLElement;
        expect(root.className).toMatch(/my-viewer/);
    });

    it(`forwards inline style onto the wrapper`, () => {
        viewerInstances.length = 0;
        const { container } = render(
            <Image360Viewer src={`/pano.jpg`} style={{ height: 320 }} />
        );
        const root = container.firstChild as HTMLElement;
        expect(root.style.height).toBe(`320px`);
    });
});
