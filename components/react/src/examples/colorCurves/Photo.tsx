import { useContext, useEffect, useMemo, useRef, useState } from "react";
import ColorCurves from "../../../lib/components/input/colorCurves/ColorCurves";
import {
    applyColorCurvesToImageData,
    computeColorCurvesHistogram,
    DEFAULT_COLOR_CURVES_VALUE,
    type ColorCurvesHistogram,
    type ColorCurvesValue
} from "../../../lib/components/input/colorCurves/applyCurves";
import { MowsContext } from "../../../lib/lib/mowsContext/MowsContext";
import samplePhotoUrl from "../../assets/samples/wittelsbacher-park-sandsturm-1024.jpg";

const PHOTO_SOURCE_URL = `https://commons.wikimedia.org/wiki/File:Wittelsbacher_Park_Augsburg_Eingang_Sandsturm_Juli_2024.jpg`;
const PHOTO_AUTHOR_URL = `https://commons.wikimedia.org/wiki/User:Firstdorsal`;
const PHOTO_AUTHOR_NAME = `Firstdorsal`;
const PHOTO_LICENSE_URL = `https://creativecommons.org/licenses/by-sa/4.0/`;
const PHOTO_LICENSE_NAME = `CC BY-SA 4.0`;
const PHOTO_TITLE = `Wittelsbacher Park Augsburg — Eingang Sandsturm, Juli 2024`;
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const mowsContext = useContext(MowsContext);
    if (!mowsContext) throw new Error(`Missing <MowsProvider>`);
    const t = mowsContext.t.example.examples.colorCurves;

    const [value, setValue] = useState<ColorCurvesValue>(
        DEFAULT_COLOR_CURVES_VALUE
    );
    const [sourceImageData, setSourceImageData] =
        useState<ImageData | null>(null);
    const [histogram, setHistogram] = useState<ColorCurvesHistogram | null>(
        null
    );
    const [dimensions, setDimensions] = useState<{
        width: number;
        height: number;
    } | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useExampleState({
        rgb: value.rgb.length,
        r: value.r.length,
        g: value.g.length,
        b: value.b.length
    });

    useEffect(() => {
        let cancelled = false;
        const img = new Image();
        img.crossOrigin = `anonymous`;
        img.src = samplePhotoUrl;
        img.onload = () => {
            if (cancelled) return;
            const offscreen = document.createElement(`canvas`);
            offscreen.width = img.naturalWidth;
            offscreen.height = img.naturalHeight;
            const ctx = offscreen.getContext(`2d`);
            if (!ctx) return;
            ctx.drawImage(img, 0, 0);
            const data = ctx.getImageData(
                0,
                0,
                offscreen.width,
                offscreen.height
            );
            setSourceImageData(data);
            setHistogram(computeColorCurvesHistogram(data));
            setDimensions({ width: img.naturalWidth, height: img.naturalHeight });
        };
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!sourceImageData || !canvasRef.current) return;
        const canvas = canvasRef.current;
        canvas.width = sourceImageData.width;
        canvas.height = sourceImageData.height;
        const ctx = canvas.getContext(`2d`);
        if (!ctx) return;
        // Clone the pixels each frame — applying curves in place would
        // compound on every change.
        const working = new ImageData(
            new Uint8ClampedArray(sourceImageData.data),
            sourceImageData.width,
            sourceImageData.height
        );
        applyColorCurvesToImageData(working, value);
        ctx.putImageData(working, 0, 0);
    }, [sourceImageData, value]);

    const aspectStyle = useMemo(() => {
        if (!dimensions) return undefined;
        return { aspectRatio: `${dimensions.width} / ${dimensions.height}` };
    }, [dimensions]);

    return (
        <div className={`flex flex-col gap-5 md:flex-row md:items-start`}>
            <div className={`flex min-w-0 flex-1 flex-col gap-2`}>
                <div
                    className={`relative w-full overflow-hidden rounded-md border bg-card`}
                    style={aspectStyle}
                >
                    {sourceImageData ? (
                        <canvas
                            ref={canvasRef}
                            className={`absolute inset-0 h-full w-full object-cover`}
                        />
                    ) : (
                        <div
                            className={`absolute inset-0 flex items-center justify-center text-xs text-muted-foreground`}
                        >
                            {t.photoLabels.loading}
                        </div>
                    )}
                </div>
                <p
                    className={`text-[11px] leading-snug text-muted-foreground`}
                    dir="ltr"
                >
                    <span>{t.photoLabels.photoLabel} </span>
                    <a
                        href={PHOTO_SOURCE_URL}
                        target={`_blank`}
                        rel={`noopener noreferrer`}
                        className={`underline underline-offset-2 hover:text-foreground`}
                    >
                        {PHOTO_TITLE}
                    </a>
                    <span> {t.photoLabels.byLabel} </span>
                    <a
                        href={PHOTO_AUTHOR_URL}
                        target={`_blank`}
                        rel={`noopener noreferrer`}
                        className={`underline underline-offset-2 hover:text-foreground`}
                    >
                        {PHOTO_AUTHOR_NAME}
                    </a>
                    <span> · </span>
                    <a
                        href={PHOTO_LICENSE_URL}
                        target={`_blank`}
                        rel={`noopener noreferrer`}
                        className={`underline underline-offset-2 hover:text-foreground`}
                    >
                        {PHOTO_LICENSE_NAME}
                    </a>
                </p>
            </div>
            <div
                className={`flex w-full shrink-0 flex-col gap-3 md:w-[320px]`}
            >
                <ColorCurves
                    value={value}
                    onChange={setValue}
                    histogram={histogram ?? undefined}
                    strings={t.componentStrings}
                    size={320}
                    className={`max-w-none`}
                />
                <div
                    className={`flex flex-col gap-1 text-[11px] leading-snug text-muted-foreground`}
                >
                    <p>{t.photoLabels.channelHint}</p>
                    <p>{t.photoLabels.addPointHint}</p>
                    <p>{t.photoLabels.deletePointHint}</p>
                    <p>{t.photoLabels.keyboardHint}</p>
                </div>
            </div>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.colorCurves.photo,
    Example
};

export default module;
