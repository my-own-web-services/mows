import SearchSelectPicker from "@/components/input/searchSelectPicker/SearchSelectPicker";
import { type MowsMapStyle } from "@/lib/mapStyles";
import { useMows } from "@/lib/mowsContext/MowsContext";
import { Map as MapIcon } from "lucide-react";
import * as React from "react";
import { forwardRef } from "react";

interface MapStylePickerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, `onSelect`> {
    readonly defaultOpen?: boolean;
    readonly onValueChange?: (value?: MowsMapStyle) => void;
    readonly standalone?: boolean;
}

const StyleSwatch = ({ mapStyle }: { mapStyle: MowsMapStyle }) => (
    <span
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border border-border`}
        style={{
            background: mapStyle.mode === `dark` ? `#1f2937` : `#e5e7eb`,
            color: mapStyle.mode === `dark` ? `#e5e7eb` : `#1f2937`
        }}
        aria-hidden
    >
        <MapIcon className={`h-3 w-3`} />
    </span>
);

const MapStylePicker = forwardRef<HTMLDivElement, MapStylePickerProps>(
    (
        { className, style, defaultOpen = false, onValueChange, standalone = false, ...rest },
        ref
    ) => {
        const { t, mapStyles, currentMapStyle, setMapStyle } = useMows();

        const renderItemContent = (mapStyle: MowsMapStyle) => (
            <>
                <StyleSwatch mapStyle={mapStyle} />
                <span className={`font-medium`}>{mapStyle.name}</span>
                {mapStyle.attribution && (
                    <span className={`text-xs text-muted-foreground opacity-70`}>
                        {mapStyle.attribution}
                    </span>
                )}
            </>
        );

        return (
            <SearchSelectPicker<MowsMapStyle>
                {...rest}
                ref={ref}
                items={mapStyles}
                selected={currentMapStyle}
                getId={(s) => s.id}
                matchesSearch={(s, search) =>
                    s.name.toLowerCase().includes(search.toLowerCase())
                }
                renderItemContent={renderItemContent}
                onSelect={(s) => {
                    setMapStyle(s);
                    onValueChange?.(s);
                }}
                onOpenChange={(open) => {
                    if (!open) onValueChange?.();
                }}
                placeholder={t.mapStylePicker.selectMapStyle}
                emptyText={t.mapStylePicker.noMapStyleFound}
                triggerTitle={t.mapStylePicker.selectMapStyle}
                standalone={standalone}
                defaultOpen={defaultOpen}
                autoFocus={standalone}
                className={className}
                style={style}
                popoverContentClassName={`w-[280px]`}
            />
        );
    }
);

MapStylePicker.displayName = `MapStylePicker`;

export default MapStylePicker;
