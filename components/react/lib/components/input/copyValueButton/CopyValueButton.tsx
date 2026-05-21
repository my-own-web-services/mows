import { log } from "@/lib/logging";
import { cn } from "@/lib/utils";
import { type CSSProperties, forwardRef, useEffect, useRef, useState } from "react";
import { IoCheckmarkSharp, IoCopySharp } from "react-icons/io5";
import { toast as sonnerToast } from "sonner";

interface CopyValueButtonProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly value: string;
    readonly label?: string;
    readonly title?: string;
    /**
     * If set, a toast is fired on successful copy. Pass `true` for a default
     * message ("Copied"), or a string to use as the toast message.
     */
    readonly toastOnCopy?: boolean | string;
}

const CopyValueButton = forwardRef<HTMLDivElement, CopyValueButtonProps>(
    ({ className, style, value, label, title, toastOnCopy, ...props }, ref) => {
        const [copied, setCopied] = useState(false);
        const timeoutRef = useRef<NodeJS.Timeout | null>(null);

        useEffect(() => {
            return () => {
                // Clean up timeout if component unmounts
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                }
            };
        }, []);

        const copyClick = async () => {
            try {
                await navigator.clipboard.writeText(value);

                setCopied(true);

                if (toastOnCopy) {
                    const message =
                        typeof toastOnCopy === `string` ? toastOnCopy : `Copied`;
                    sonnerToast.success(message);
                }

                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                }

                timeoutRef.current = setTimeout(() => {
                    setCopied(false);
                    timeoutRef.current = null;
                }, 1500);
            } catch (err) {
                log.error(`Failed to copy text: `, err);
            }
        };

        return (
            <div
                {...props}
                ref={ref}
                style={style}
                className={cn(
                    className,
                    // `justify-center` so the icon sits in the middle of
                    // a square (icon-only) button instead of left-hugging
                    // it — when the button is right-anchored with
                    // `ml-auto`, left-alignment pushed the icon flush
                    // against the surrounding border (looked like the
                    // copy affordance was cropped).
                    `CopyValueButton text-muted-foreground flex cursor-pointer items-center justify-center gap-2 rounded text-sm transition-all duration-200 select-none`
                )}
                onClick={copyClick}
                title={copied ? `Copied!` : (title ?? ``)}
            >
                {label !== undefined && <span>{label}</span>}
                {copied ? (
                    <IoCheckmarkSharp className={`text-success duration-200`} />
                ) : (
                    <IoCopySharp />
                )}
            </div>
        );
    }
);

CopyValueButton.displayName = `CopyValueButton`;

export default CopyValueButton;
