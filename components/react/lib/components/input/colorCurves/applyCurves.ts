import {
    buildCurveLUT,
    type ColorCurvePoint
} from "./curveMath";

export type ColorCurvesChannel = `rgb` | `r` | `g` | `b`;

export type ColorCurvesValue = {
    readonly [K in ColorCurvesChannel]: ReadonlyArray<ColorCurvePoint>;
};

export interface ColorCurvesHistogram {
    /** Luminance histogram derived from the source pixels. */
    readonly rgb: ReadonlyArray<number>;
    readonly r: ReadonlyArray<number>;
    readonly g: ReadonlyArray<number>;
    readonly b: ReadonlyArray<number>;
}

export const COLOR_CURVES_CHANNELS: readonly ColorCurvesChannel[] = [
    `rgb`,
    `r`,
    `g`,
    `b`
];

export const DEFAULT_COLOR_CURVES_VALUE: ColorCurvesValue = {
    rgb: [
        { x: 0, y: 0 },
        { x: 1, y: 1 }
    ],
    r: [
        { x: 0, y: 0 },
        { x: 1, y: 1 }
    ],
    g: [
        { x: 0, y: 0 },
        { x: 1, y: 1 }
    ],
    b: [
        { x: 0, y: 0 },
        { x: 1, y: 1 }
    ]
};

/**
 * Apply a curves value to an ImageData buffer in place. The composite
 * `rgb` curve is applied first to every channel, then per-channel
 * curves on top. Alpha is left untouched.
 */
export const applyColorCurvesToImageData = (
    imageData: ImageData,
    value: ColorCurvesValue
): void => {
    const composite = buildCurveLUT(value.rgb);
    const red = buildCurveLUT(value.r);
    const green = buildCurveLUT(value.g);
    const blue = buildCurveLUT(value.b);

    const data = imageData.data;
    const length = data.length;
    for (let i = 0; i < length; i += 4) {
        data[i] = red[composite[data[i]!]!]!;
        data[i + 1] = green[composite[data[i + 1]!]!]!;
        data[i + 2] = blue[composite[data[i + 2]!]!]!;
    }
};

/**
 * Compute a 4-channel histogram (luminance + R + G + B) from an
 * ImageData buffer. Each channel has 256 bins.
 *
 * Luminance uses the Rec. 709 weights so it matches how people
 * perceive brightness — that's also what most photo apps display.
 */
export const computeColorCurvesHistogram = (
    imageData: ImageData
): ColorCurvesHistogram => {
    const rgb = new Array<number>(256).fill(0);
    const r = new Array<number>(256).fill(0);
    const g = new Array<number>(256).fill(0);
    const b = new Array<number>(256).fill(0);

    const data = imageData.data;
    const length = data.length;
    for (let i = 0; i < length; i += 4) {
        const ri = data[i]!;
        const gi = data[i + 1]!;
        const bi = data[i + 2]!;
        r[ri] = (r[ri] ?? 0) + 1;
        g[gi] = (g[gi] ?? 0) + 1;
        b[bi] = (b[bi] ?? 0) + 1;
        const lum = Math.min(
            255,
            Math.round(0.2126 * ri + 0.7152 * gi + 0.0722 * bi)
        );
        rgb[lum] = (rgb[lum] ?? 0) + 1;
    }

    return { rgb, r, g, b };
};
