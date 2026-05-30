import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Standard shadcn-style `cn` helper for composing Tailwind class strings. */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
