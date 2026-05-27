/**
 * Color-curve math: monotonic cubic interpolation through control points
 * and 256-entry LUT generation suitable for canvas ImageData manipulation.
 *
 * The Fritsch-Carlson monotonic cubic Hermite scheme is used so the curve
 * never overshoots between control points — a non-negotiable for color
 * grading (an overshoot would push a clamped value into clipping noise).
 */

export interface ColorCurvePoint {
    /** Both coordinates are normalised to [0, 1]. */
    readonly x: number;
    readonly y: number;
}

export const LUT_SIZE = 256;

export const IDENTITY_CURVE: ReadonlyArray<ColorCurvePoint> = [
    { x: 0, y: 0 },
    { x: 1, y: 1 }
];

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Sort + dedupe control points by x so interpolation has a strictly
 * increasing input. Equal x values are merged (last write wins).
 */
export const normaliseCurvePoints = (
    points: ReadonlyArray<ColorCurvePoint>
): ColorCurvePoint[] => {
    if (points.length === 0) {
        return IDENTITY_CURVE.map((p) => ({ ...p }));
    }
    const cloned = points.map((p) => ({
        x: clamp01(p.x),
        y: clamp01(p.y)
    }));
    cloned.sort((a, b) => a.x - b.x);
    const deduped: ColorCurvePoint[] = [];
    for (const p of cloned) {
        const last = deduped[deduped.length - 1];
        if (last && Math.abs(last.x - p.x) < 1e-6) {
            deduped[deduped.length - 1] = p;
        } else {
            deduped.push(p);
        }
    }
    if (deduped.length === 1) {
        // A single point is meaningless — re-introduce an endpoint so the
        // curve has a defined shape across the entire input range.
        const only = deduped[0]!;
        if (only.x < 0.5) {
            deduped.push({ x: 1, y: only.y });
        } else {
            deduped.unshift({ x: 0, y: only.y });
        }
    }
    return deduped;
};

/**
 * Sample the curve at `x` ∈ [0,1] using monotonic cubic Hermite
 * interpolation (Fritsch–Carlson).
 */
export const sampleCurve = (
    points: ReadonlyArray<ColorCurvePoint>,
    x: number
): number => {
    const pts = normaliseCurvePoints(points);
    const n = pts.length;
    const xc = clamp01(x);
    if (xc <= pts[0]!.x) return pts[0]!.y;
    if (xc >= pts[n - 1]!.x) return pts[n - 1]!.y;

    let i = 0;
    while (i < n - 1 && pts[i + 1]!.x < xc) i++;

    const x0 = pts[i]!.x;
    const x1 = pts[i + 1]!.x;
    const y0 = pts[i]!.y;
    const y1 = pts[i + 1]!.y;
    const h = x1 - x0;
    if (h <= 0) return y0;

    const slopes: number[] = new Array(n - 1);
    for (let k = 0; k < n - 1; k++) {
        const dx = pts[k + 1]!.x - pts[k]!.x;
        slopes[k] = dx > 0 ? (pts[k + 1]!.y - pts[k]!.y) / dx : 0;
    }

    const tangents: number[] = new Array(n);
    tangents[0] = slopes[0]!;
    tangents[n - 1] = slopes[n - 2]!;
    for (let k = 1; k < n - 1; k++) {
        const sPrev = slopes[k - 1]!;
        const sNext = slopes[k]!;
        if (sPrev * sNext <= 0) {
            tangents[k] = 0;
        } else {
            tangents[k] = (sPrev + sNext) / 2;
        }
    }
    for (let k = 0; k < n - 1; k++) {
        const s = slopes[k]!;
        if (s === 0) {
            tangents[k] = 0;
            tangents[k + 1] = 0;
            continue;
        }
        const a = tangents[k]! / s;
        const b = tangents[k + 1]! / s;
        const hyp = a * a + b * b;
        if (hyp > 9) {
            const tau = 3 / Math.sqrt(hyp);
            tangents[k] = tau * a * s;
            tangents[k + 1] = tau * b * s;
        }
    }

    const t = (xc - x0) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    const y =
        h00 * y0 + h10 * h * tangents[i]! + h01 * y1 + h11 * h * tangents[i + 1]!;
    return clamp01(y);
};

/**
 * Build a 256-entry LUT for the curve. Entry `i` answers: "If a channel
 * has value `i`, what value should it map to?" — both clamped to [0,255].
 */
export const buildCurveLUT = (
    points: ReadonlyArray<ColorCurvePoint>
): Uint8ClampedArray => {
    const lut = new Uint8ClampedArray(LUT_SIZE);
    for (let i = 0; i < LUT_SIZE; i++) {
        const x = i / (LUT_SIZE - 1);
        lut[i] = Math.round(sampleCurve(points, x) * 255);
    }
    return lut;
};

/**
 * Test if the curve is the identity (every input maps to itself within
 * one quantisation step). Used to skip per-pixel work when the user
 * hasn't actually touched a channel.
 */
export const isIdentityCurve = (
    points: ReadonlyArray<ColorCurvePoint>
): boolean => {
    if (points.length !== 2) return false;
    const a = points[0]!;
    const b = points[1]!;
    return (
        Math.abs(a.x) < 1e-6 &&
        Math.abs(a.y) < 1e-6 &&
        Math.abs(b.x - 1) < 1e-6 &&
        Math.abs(b.y - 1) < 1e-6
    );
};
