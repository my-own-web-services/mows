import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
    Sidebar,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider
} from "./sidebar";

// Render the Sidebar inside a resizable provider. The fixed-position div
// inside the primitive is the one we measure for width / class assertions.
const renderResizable = (
    overrides: Parameters<typeof SidebarProvider>[0] = {}
) =>
    render(
        <SidebarProvider
            resizable
            defaultWidthPx={256}
            minWidthPx={160}
            maxWidthPx={512}
            {...overrides}
        >
            <Sidebar />
        </SidebarProvider>
    );

const getFixedSidebar = (): HTMLElement => {
    const el = document.querySelector(`.fixed.inset-y-0`);
    if (!el) throw new Error(`fixed sidebar wrapper not found`);
    return el as HTMLElement;
};

const getHandle = (): HTMLElement => {
    const el = document.querySelector(`[data-sidebar="resize-handle"]`);
    if (!el) throw new Error(`resize handle not found`);
    return el as HTMLElement;
};

const getCssVar = (): string => {
    const wrapper = document.querySelector(
        `.group\\/sidebar-wrapper`
    ) as HTMLElement | null;
    return wrapper?.style.getPropertyValue(`--sidebar-width`) ?? ``;
};

const readWidthCookie = (): number | null => {
    const m = document.cookie.match(/(?:^|; )sidebar_width=(\d+)/);
    return m ? Number(m[1]) : null;
};

const drag = (handle: HTMLElement, startX: number, endX: number) => {
    act(() => {
        handle.dispatchEvent(
            new PointerEvent(`pointerdown`, {
                clientX: startX,
                button: 0,
                bubbles: true,
                cancelable: true
            })
        );
    });
    act(() => {
        window.dispatchEvent(
            new PointerEvent(`pointermove`, { clientX: endX, bubbles: true })
        );
    });
    act(() => {
        window.dispatchEvent(
            new PointerEvent(`pointerup`, { clientX: endX, bubbles: true })
        );
    });
};

describe(`Sidebar (resizable)`, () => {
    beforeEach(() => {
        // Clear any persisted width from previous tests.
        document.cookie = `sidebar_width=; path=/; max-age=0`;
    });

    afterEach(() => {
        document.cookie = `sidebar_width=; path=/; max-age=0`;
    });

    it(`uses Tailwind v4 var() syntax so width actually applies`, () => {
        // Regression guard: w-[--sidebar-width] emits `width: --sidebar-width`
        // (invalid) on Tailwind v4. The fix is w-(--sidebar-width).
        renderResizable();
        const cls = getFixedSidebar().className;
        expect(cls).toContain(`w-(--sidebar-width)`);
        expect(cls).not.toContain(`w-[--sidebar-width]`);
    });

    it(`seeds --sidebar-width from defaultWidthPx`, () => {
        renderResizable({ defaultWidthPx: 240 });
        expect(getCssVar()).toBe(`240px`);
    });

    it(`renders the resize handle when resizable`, () => {
        renderResizable();
        expect(getHandle()).toBeInTheDocument();
    });

    it(`does not render the resize handle when resizable is false`, () => {
        render(
            <SidebarProvider>
                <Sidebar />
            </SidebarProvider>
        );
        expect(
            document.querySelector(`[data-sidebar="resize-handle"]`)
        ).toBeNull();
    });

    it(`updates width and persists to cookie on drag`, () => {
        renderResizable({ defaultWidthPx: 256 });
        drag(getHandle(), 256, 356);
        expect(getCssVar()).toBe(`356px`);
        expect(readWidthCookie()).toBe(356);
    });

    it(`clamps drag to maxWidthPx`, () => {
        renderResizable({ defaultWidthPx: 256, maxWidthPx: 400 });
        drag(getHandle(), 256, 9999);
        expect(getCssVar()).toBe(`400px`);
        expect(readWidthCookie()).toBe(400);
    });

    it(`clamps drag to minWidthPx`, () => {
        renderResizable({ defaultWidthPx: 256, minWidthPx: 200 });
        drag(getHandle(), 256, -9999);
        expect(getCssVar()).toBe(`200px`);
        expect(readWidthCookie()).toBe(200);
    });

    it(`double-clicking the handle resets to defaultWidthPx`, () => {
        renderResizable({ defaultWidthPx: 256 });
        drag(getHandle(), 256, 380);
        expect(getCssVar()).toBe(`380px`);

        act(() => {
            getHandle().dispatchEvent(
                new MouseEvent(`dblclick`, { bubbles: true })
            );
        });

        expect(getCssVar()).toBe(`256px`);
        expect(readWidthCookie()).toBe(256);
    });

    it(`restores the persisted width from cookie on mount`, () => {
        document.cookie = `sidebar_width=312; path=/`;
        renderResizable({ defaultWidthPx: 256 });
        expect(getCssVar()).toBe(`312px`);
    });

    it(`re-clamps a persisted width that falls outside new bounds`, () => {
        document.cookie = `sidebar_width=800; path=/`;
        renderResizable({ defaultWidthPx: 256, maxWidthPx: 500 });
        expect(getCssVar()).toBe(`500px`);
    });

    it(`drags inward when the sidebar is on the right`, () => {
        renderResizable({ defaultWidthPx: 256 });
        // Side is set on the <Sidebar /> child, but our renderResizable only
        // mounts the left-side default. Re-render with side="right".
        render(
            <SidebarProvider resizable defaultWidthPx={256}>
                <Sidebar side={`right`} />
            </SidebarProvider>
        );
        // Two providers now; grab the right-side handle (last one rendered).
        const handles = document.querySelectorAll(
            `[data-sidebar="resize-handle"]`
        );
        const rightHandle = handles[handles.length - 1] as HTMLElement;
        // On the right side, dragging left (decreasing clientX) grows width.
        drag(rightHandle, 1000, 900);
        // The right-side provider should reflect the new width.
        const wrappers = document.querySelectorAll(`.group\\/sidebar-wrapper`);
        const lastWrapper = wrappers[wrappers.length - 1] as HTMLElement;
        expect(lastWrapper.style.getPropertyValue(`--sidebar-width`)).toBe(
            `356px`
        );
    });
});

describe(`Sidebar (appearance)`, () => {
    const renderMenu = (
        appearance?: Parameters<typeof SidebarProvider>[0][`appearance`]
    ) =>
        render(
            <SidebarProvider appearance={appearance}>
                <Sidebar>
                    <SidebarHeader>Brand</SidebarHeader>
                    <SidebarGroup data-testid={`grp`}>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                <SidebarMenuItem>
                                    <SidebarMenuButton>Item</SidebarMenuButton>
                                </SidebarMenuItem>
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                    <SidebarFooter>Account</SidebarFooter>
                </Sidebar>
            </SidebarProvider>
        );

    const group = (): HTMLElement =>
        document.querySelector(`[data-sidebar="group"]`) as HTMLElement;
    const menuButton = (): HTMLElement =>
        document.querySelector(`[data-sidebar="menu-button"]`) as HTMLElement;
    const header = (): HTMLElement =>
        document.querySelector(`[data-sidebar="header"]`) as HTMLElement;
    const footer = (): HTMLElement =>
        document.querySelector(`[data-sidebar="footer"]`) as HTMLElement;

    it(`defaults to the inset "pill" look (group/header/footer padded, button rounded)`, () => {
        renderMenu();
        expect(group().className).toContain(`p-2`);
        expect(group().className).not.toContain(`px-0`);
        expect(header().className).not.toContain(`px-0`);
        expect(footer().className).not.toContain(`p-0`);
        expect(menuButton().className).toContain(`rounded-md`);
        expect(menuButton().className).not.toContain(`rounded-none`);
    });

    it(`flush: items/header span full width; footer is fully flush (bottom too); button drops its radius`, () => {
        renderMenu(`flush`);
        // Full-bleed: group + header drop horizontal padding; the footer
        // (account/PrimaryMenu) drops ALL padding so it sits flush with the
        // sidebar's bottom edge (no gap underneath), not just left/right.
        expect(group().className).toContain(`px-0`);
        expect(header().className).toContain(`px-0`);
        // Exact class tokens — `className.includes("p-2")` would false-match the
        // "p-2" inside "gap-2", so split and compare whole classes.
        const footerClasses = footer().className.split(/\s+/);
        expect(footerClasses).toContain(`p-0`);
        expect(footerClasses).not.toContain(`p-2`);
        expect(menuButton().className).toContain(`rounded-none`);
    });
});
