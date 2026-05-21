import * as React from "react";
import SectionHeading from "../../../../lib/components/navigation/sectionHeading/SectionHeading";
import { cn } from "../../../../lib/lib/utils";
import { renderDescription } from "./renderInlineMarkup";

interface BaseHeadingProps {
    /** Anchor id (without component-name prefix — the URL already names the component). */
    readonly id: string;
    /** Heading text. */
    readonly title: React.ReactNode;
    /**
     * Optional sub-heading body shown under the heading. When passed as a
     * plain string, any backticked or `<TagName>` fragment is promoted to
     * a `<CodeSnippet mode="inline">` chip automatically. Pass a ReactNode
     * to opt out and supply your own structured content.
     */
    readonly description?: React.ReactNode;
    /** Section content rendered under the heading + description. */
    readonly children?: React.ReactNode;
    readonly className?: string;
}

/**
 * Top-level (h3) doc section. Provides the permalink heading, optional
 * description, and a vertical-stack for the section body. Top-level
 * sections are separated by the `<DocPage>` parent — don't add outer
 * margins here.
 */
export const DocSection = ({ id, title, description, children, className }: BaseHeadingProps) => (
    <section className={cn(`flex flex-col gap-4`, className)}>
        <header>
            <SectionHeading id={id} level={3} className={`text-xl font-semibold tracking-tight`}>
                {title}
            </SectionHeading>
            {description !== undefined && description !== null && description !== `` && (
                <p className={`mt-2 text-sm text-muted-foreground`}>
                    {renderDescription(description)}
                </p>
            )}
        </header>
        {children}
    </section>
);

/**
 * Nested (h4) section inside a `<DocSection>` — e.g. one example inside
 * the parent "Examples" section.
 */
export const DocSubsection = ({
    id,
    title,
    description,
    children,
    className
}: BaseHeadingProps) => (
    <section className={cn(`flex flex-col gap-3`, className)}>
        <header>
            <SectionHeading id={id} level={4} className={`text-base font-semibold`}>
                {title}
            </SectionHeading>
            {description !== undefined && description !== null && description !== `` && (
                <p className={`mt-1 text-sm text-muted-foreground`}>
                    {renderDescription(description)}
                </p>
            )}
        </header>
        {children}
    </section>
);
