import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// AutoSizer reports zero in jsdom; feed a fixed viewport (mirrors Chat.test).
import { vi } from "vitest";
vi.mock(`react-virtualized-auto-sizer`, () => ({
    default: ({
        children
    }: {
        children: (size: { width: number; height: number }) => React.ReactNode;
    }) => children({ width: 800, height: 600 })
}));

import Chat from "./Chat";
import type { ChatMessage, ChatUser } from "./types";

const USERS: Record<string, ChatUser> = {
    alice: { id: `alice`, name: `Alice` },
    bob: { id: `bob`, name: `Bob` }
};

const msg = (overrides: Partial<ChatMessage>): ChatMessage => ({
    id: `m1`,
    authorId: `alice`,
    body: ``,
    createdAt: Date.now(),
    ...overrides
});

describe(`Chat — rich media`, () => {
    it(`renders an image attachment inline and opens the full-screen lightbox on click`, () => {
        const messages = [
            msg({
                attachments: [
                    { id: `a1`, name: `photo.png`, url: `/img/photo.png`, mimeType: `image/png` }
                ]
            })
        ];
        render(<Chat messages={messages} users={USERS} currentUserId={`alice`} />);
        const trigger = screen.getByRole(`button`, { name: /open preview/i });
        const img = trigger.querySelector(`img`);
        expect(img).toHaveAttribute(`src`, `/img/photo.png`);
        expect(screen.queryByTestId(`chat-lightbox`)).toBeNull();
        fireEvent.click(trigger);
        const lightbox = screen.getByTestId(`chat-lightbox`);
        expect(lightbox).toBeInTheDocument();
        // Full-bleed overlay.
        expect(lightbox.className).toContain(`fixed`);
        expect(lightbox.className).toContain(`inset-0`);
    });

    it(`renders a voice attachment's transcript when done, and "transcribing" while pending`, () => {
        const done = render(
            <Chat
                messages={[
                    msg({
                        attachments: [
                            {
                                id: `v1`,
                                name: `voice.webm`,
                                url: `/a/v1`,
                                mimeType: `audio/webm`,
                                kind: `voice`,
                                transcript: `hello there`,
                                transcriptStatus: `done`
                            }
                        ]
                    })
                ]}
                users={USERS}
                currentUserId={`alice`}
            />
        );
        expect(screen.getByTestId(`chat-transcript`)).toHaveTextContent(`hello there`);
        done.unmount();

        render(
            <Chat
                messages={[
                    msg({
                        attachments: [
                            {
                                id: `v2`,
                                name: `voice.webm`,
                                url: `/a/v2`,
                                mimeType: `audio/webm`,
                                kind: `voice`,
                                transcriptStatus: `pending`
                            }
                        ]
                    })
                ]}
                users={USERS}
                currentUserId={`alice`}
                strings={{ transcribing: `Wird transkribiert…` }}
            />
        );
        expect(screen.getByText(`Wird transkribiert…`)).toBeInTheDocument();
    });

    it(`renders a generic file attachment as a download link`, () => {
        render(
            <Chat
                messages={[
                    msg({
                        attachments: [
                            {
                                id: `f1`,
                                name: `report.pdf`,
                                url: `/a/f1`,
                                mimeType: `application/pdf`
                            }
                        ]
                    })
                ]}
                users={USERS}
                currentUserId={`alice`}
            />
        );
        const link = screen.getByRole(`link`, { name: /report\.pdf/i });
        expect(link).toHaveAttribute(`href`, `/a/f1`);
        expect(link).toHaveAttribute(`download`);
    });

    it(`renders custom content via renderMessageExtra`, () => {
        render(
            <Chat
                messages={[msg({ id: `mx`, body: `see offer`, metadata: { offerId: 7 } })]}
                users={USERS}
                currentUserId={`alice`}
                renderMessageExtra={(m) =>
                    m.metadata?.offerId ? (
                        <div data-testid={`offer-card`}>Offer #{String(m.metadata.offerId)}</div>
                    ) : null
                }
            />
        );
        expect(screen.getByTestId(`offer-card`)).toHaveTextContent(`Offer #7`);
    });

    it(`merges the strings prop over the defaults`, () => {
        render(
            <Chat
                messages={[msg({ body: `hi` })]}
                users={USERS}
                currentUserId={`alice`}
                onSend={() => {}}
                strings={{ sendButton: `Senden` }}
            />
        );
        expect(screen.getByRole(`button`, { name: `Senden` })).toBeInTheDocument();
    });
});

describe(`Chat — composer opt-ins`, () => {
    it(`shows the attach button only when enableAttachments is set`, () => {
        const { rerender } = render(
            <Chat messages={[]} users={USERS} currentUserId={`alice`} onSend={() => {}} />
        );
        expect(screen.queryByTestId(`chat-composer-attach`)).toBeNull();
        rerender(
            <Chat
                messages={[]}
                users={USERS}
                currentUserId={`alice`}
                onSend={() => {}}
                enableAttachments
            />
        );
        expect(screen.getByTestId(`chat-composer-attach`)).toBeInTheDocument();
    });

    it(`shows the record button only when enableVoice is set`, () => {
        render(
            <Chat
                messages={[]}
                users={USERS}
                currentUserId={`alice`}
                onSend={() => {}}
                enableVoice
            />
        );
        expect(screen.getByTestId(`chat-composer-record`)).toBeInTheDocument();
    });
});
