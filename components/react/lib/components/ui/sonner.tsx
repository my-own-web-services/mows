import { MowsContext } from "@/lib/mowsContext/MowsContext";
import { useTheme } from "next-themes";
import { useContext } from "react";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ position, ...props }: ToasterProps) => {
    const { theme = `system` } = useTheme();
    // Read from context optionally — Toaster may render before/outside a
    // MowsProvider (e.g. unit tests). A prop-supplied `position` always wins
    // so consumers can still pin it explicitly.
    const mows = useContext(MowsContext);
    const resolvedPosition = position ?? mows?.toastSettings.position;

    return (
        <Sonner
            theme={theme as ToasterProps[`theme`]}
            position={resolvedPosition}
            className={`toaster group`}
            toastOptions={{
                classNames: {
                    toast: `group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg`,
                    description: `group-[.toast]:text-muted-foreground`,
                    actionButton:
                        `group-[.toast]:bg-primary group-[.toast]:text-primary-foreground`,
                    cancelButton: `group-[.toast]:bg-muted group-[.toast]:text-muted-foreground`
                }
            }}
            {...props}
        />
    );
};

export { Toaster };
