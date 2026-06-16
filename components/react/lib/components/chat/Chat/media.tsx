import { Download, X } from "lucide-react";
import { useEffect, type CSSProperties } from "react";
import { Button } from "../../ui/button";
import type { ChatAttachment, ChatAttachmentKind } from "./types";

/**
 * Resolve the rendering kind of an attachment: prefer the explicit `kind`,
 * otherwise derive it from the MIME type. Unknown types fall back to `file`.
 */
export const resolveAttachmentKind = (att: ChatAttachment): ChatAttachmentKind => {
    if (att.kind) return att.kind;
    const mime = att.mimeType ?? ``;
    if (mime.startsWith(`image/`)) return `image`;
    if (mime.startsWith(`video/`)) return `video`;
    if (mime.startsWith(`audio/`)) return `voice`;
    return `file`;
};

export interface LightboxSource {
    readonly kind: `image` | `video`;
    readonly src: string;
    readonly downloadHref: string;
    readonly name: string;
}

interface MediaLightboxProps {
    readonly source: LightboxSource | null;
    readonly onClose: () => void;
    readonly closeLabel: string;
    readonly downloadLabel: string;
    readonly zIndex?: number;
}

/**
 * Full-screen overlay preview for image/video attachments — closes on the
 * backdrop, the X button, or Escape; a button downloads the original. Lives
 * at the Chat level (not per row) so it survives row virtualization.
 */
export const MediaLightbox = ({
    source,
    onClose,
    closeLabel,
    downloadLabel,
    zIndex = 60
}: MediaLightboxProps) => {
    useEffect(() => {
        if (!source) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === `Escape`) onClose();
        };
        document.addEventListener(`keydown`, onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = `hidden`;
        return () => {
            document.removeEventListener(`keydown`, onKey);
            document.body.style.overflow = prev;
        };
    }, [source, onClose]);

    if (!source) return null;

    return (
        <div
            role={`dialog`}
            aria-modal={`true`}
            aria-label={source.name || closeLabel}
            onClick={onClose}
            style={{ zIndex } as CSSProperties}
            className={`fixed inset-0 flex flex-col bg-black/85 backdrop-blur-sm`}
            data-testid={`chat-lightbox`}
        >
            <div className={`flex items-center justify-end gap-1 p-3`}>
                <Button
                    asChild
                    size={`icon`}
                    variant={`ghost`}
                    className={`size-9 text-white hover:bg-white/10 hover:text-white`}
                >
                    <a
                        href={source.downloadHref}
                        download={source.name || ``}
                        aria-label={downloadLabel}
                        title={downloadLabel}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Download className={`size-5`} aria-hidden />
                    </a>
                </Button>
                <Button
                    type={`button`}
                    size={`icon`}
                    variant={`ghost`}
                    onClick={onClose}
                    aria-label={closeLabel}
                    title={closeLabel}
                    className={`size-9 text-white hover:bg-white/10 hover:text-white`}
                >
                    <X className={`size-5`} aria-hidden />
                </Button>
            </div>
            <div className={`flex min-h-0 flex-1 items-center justify-center p-4 sm:p-8`}>
                {source.kind === `image` ? (
                    <img
                        src={source.src}
                        alt={source.name}
                        onClick={(e) => e.stopPropagation()}
                        className={`max-h-full max-w-full rounded-md object-contain shadow-2xl`}
                    />
                ) : (
                    <video
                        src={source.src}
                        controls
                        autoPlay
                        onClick={(e) => e.stopPropagation()}
                        className={`max-h-full max-w-full rounded-md shadow-2xl`}
                    />
                )}
            </div>
        </div>
    );
};

export default MediaLightbox;
