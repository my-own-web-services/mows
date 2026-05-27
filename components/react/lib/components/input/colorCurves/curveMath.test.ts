import { describe, expect, it } from "vitest";
import {
    buildCurveLUT,
    IDENTITY_CURVE,
    isIdentityCurve,
    normaliseCurvePoints,
    sampleCurve
} from "./curveMath";

describe(`curveMath`, () => {
    it(`identity curve LUT is the identity map`, () => {
        const lut = buildCurveLUT(IDENTITY_CURVE);
        for (let i = 0; i < 256; i++) {
            expect(lut[i]).toBe(i);
        }
    });

    it(`sampleCurve clamps to endpoint y values past the boundary`, () => {
        const curve = [
            { x: 0, y: 0.2 },
            { x: 1, y: 0.8 }
        ];
        expect(sampleCurve(curve, -1)).toBe(0.2);
        expect(sampleCurve(curve, 2)).toBe(0.8);
    });

    it(`monotonic curve through three points never overshoots`, () => {
        const curve = [
            { x: 0, y: 0 },
            { x: 0.5, y: 0.5 },
            { x: 1, y: 1 }
        ];
        for (let i = 0; i <= 100; i++) {
            const x = i / 100;
            const y = sampleCurve(curve, x);
            expect(y).toBeGreaterThanOrEqual(0);
            expect(y).toBeLessThanOrEqual(1);
        }
    });

    it(`normaliseCurvePoints sorts and dedupes by x`, () => {
        const unsorted = [
            { x: 0.5, y: 0.5 },
            { x: 0, y: 0 },
            { x: 1, y: 1 },
            { x: 0.5, y: 0.7 }
        ];
        const sorted = normaliseCurvePoints(unsorted);
        expect(sorted).toHaveLength(3);
        expect(sorted[0]!.x).toBe(0);
        expect(sorted[2]!.x).toBe(1);
        // Dedup keeps the last write for duplicates.
        expect(sorted[1]).toEqual({ x: 0.5, y: 0.7 });
    });

    it(`isIdentityCurve recognises the canonical identity`, () => {
        expect(isIdentityCurve(IDENTITY_CURVE)).toBe(true);
        expect(
            isIdentityCurve([
                { x: 0, y: 0 },
                { x: 0.5, y: 0.5 },
                { x: 1, y: 1 }
            ])
        ).toBe(false);
    });
});
