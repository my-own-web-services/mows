import { log } from "@/lib/logging";
import { cn } from "@/lib/utils";
import { type CSSProperties, forwardRef, useEffect, useRef, useState } from "react";
import { IoCheckmarkSharp, IoCopySharp } from "react-icons/io5";

interface CopyValueButtonProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly value: string;
    readonly label: string;
    readonly title?: string;
}

const CopyValueButton = forwardRef<HTMLDivElement, CopyValueButtonProps>(
    ({ className, style, value, label, title, ...props }, ref) => {
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

                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                }

                timeoutRef.current = setTimeout(() => {
                    setCopied(false);
                    timeoutRef.current = null;
                }, 1500);
            } catch (err) {
                log.error("Failed to copy text: ", err);
            }
        };

        return (
            <div
                {...props}
                ref={ref}
                style={style}
                className={cn(
                    className,
                    "CopyValueButton text-muted-foreground flex cursor-pointer items-center gap-2 rounded text-sm transition-all duration-200 select-none"
                )}
                onClick={copyClick}
                title={copied ? "Copied!" : (title ?? "")}
            >
                <span>{label}</span>
                {copied ? (
                    <IoCheckmarkSharp className="text-success duration-200" />
                ) : (
                    <IoCopySharp />
                )}
            </div>
        );
    }
);

CopyValueButton.displayName = "CopyValueButton";

export default CopyValueButton;
