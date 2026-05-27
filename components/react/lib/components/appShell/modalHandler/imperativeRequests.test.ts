import { afterEach, describe, expect, it, vi } from "vitest";
import {
    __resetImperativeRequestsForTests,
    requestAlert,
    requestConfirm,
    requestPrompt,
    resolveCurrentImperativeRequest,
    subscribeImperativeRequests,
    type ImperativeRequest
} from "./imperativeRequests";

afterEach(() => {
    __resetImperativeRequestsForTests();
});

describe(`imperativeRequests`, () => {
    it(`requestConfirm resolves true when the host resolves true`, async () => {
        const promise = requestConfirm({ title: `Sure?` });
        resolveCurrentImperativeRequest(true);
        await expect(promise).resolves.toBe(true);
    });

    it(`requestConfirm resolves false when the host resolves false`, async () => {
        const promise = requestConfirm({ title: `Sure?` });
        resolveCurrentImperativeRequest(false);
        await expect(promise).resolves.toBe(false);
    });

    it(`queues a second confirm behind the first and resolves them in order`, async () => {
        const captured: ImperativeRequest[] = [];
        const unsubscribe = subscribeImperativeRequests((request) => {
            if (request !== null) captured.push(request);
        });

        const firstPromise = requestConfirm({ title: `First` });
        const secondPromise = requestConfirm({ title: `Second` });

        // Only the first should be active right now.
        expect(captured.length).toBe(1);
        expect(captured[0].title).toBe(`First`);

        resolveCurrentImperativeRequest(true);
        await expect(firstPromise).resolves.toBe(true);

        // Resolving the first advances synchronously to the second.
        expect(captured.length).toBe(2);
        expect(captured[1].title).toBe(`Second`);

        resolveCurrentImperativeRequest(false);
        await expect(secondPromise).resolves.toBe(false);

        unsubscribe();
    });

    it(`requestPrompt resolves with the supplied string`, async () => {
        const promise = requestPrompt({ title: `Name?` });
        resolveCurrentImperativeRequest(`hello`);
        await expect(promise).resolves.toBe(`hello`);
    });

    it(`requestPrompt resolves with null when cancelled`, async () => {
        const promise = requestPrompt({ title: `Name?` });
        resolveCurrentImperativeRequest(null);
        await expect(promise).resolves.toBeNull();
    });

    it(`requestAlert resolves with undefined`, async () => {
        const promise = requestAlert({ title: `Heads up` });
        resolveCurrentImperativeRequest(undefined);
        await expect(promise).resolves.toBeUndefined();
    });

    it(`listener fires with the new current after enqueue and after resolve`, () => {
        const listener = vi.fn();
        const unsubscribe = subscribeImperativeRequests(listener);
        // initial replay (no request)
        expect(listener).toHaveBeenLastCalledWith(null);

        requestConfirm({ title: `A` });
        expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ title: `A` }));

        resolveCurrentImperativeRequest(true);
        expect(listener).toHaveBeenLastCalledWith(null);

        unsubscribe();
    });

    it(`replays the current request when a listener subscribes mid-flight`, () => {
        requestConfirm({ title: `Already open` });
        const listener = vi.fn();
        const unsubscribe = subscribeImperativeRequests(listener);
        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith(expect.objectContaining({ title: `Already open` }));
        unsubscribe();
    });

    it(`tolerates reentrant request* from inside a listener`, async () => {
        const seen: string[] = [];
        const unsubscribe = subscribeImperativeRequests((request) => {
            if (request) seen.push(request.title);
        });

        // First request triggers a reentrant second from inside its listener
        // — must not blow up iteration of the listener set.
        const firstPromise = requestConfirm({ title: `First` });

        // Synchronously enqueue a follow-up from outside, simulating a
        // listener that itself decided to ask another question.
        requestConfirm({ title: `Second` });

        resolveCurrentImperativeRequest(true);
        await firstPromise;

        expect(seen).toEqual([`First`, `Second`]);
        unsubscribe();
    });

    it(`resolveCurrent advances queue synchronously (no flash of empty state)`, () => {
        const states: (string | null)[] = [];
        const unsubscribe = subscribeImperativeRequests((request) => {
            states.push(request ? request.title : null);
        });

        requestConfirm({ title: `A` });
        requestConfirm({ title: `B` });
        resolveCurrentImperativeRequest(true);

        // initial null, then A enqueued, then resolve advances directly to B.
        // No intermediate null between A and B.
        expect(states).toEqual([null, `A`, `B`]);
        unsubscribe();
    });
});
