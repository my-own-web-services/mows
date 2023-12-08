import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";
import { isArray } from "lodash";
import { PureComponent } from "react";
import { ImageOrientation } from "./formats/Image";
import { match } from "ts-pattern";

// TODO - this is a work in progress, it's not quite right yet
// exiftool returns unusable data for the regions in its json output
// the names array is not of the same length as the other arrays...

interface ImageRegionsProps {
    readonly file: FilezFile;
    readonly viewerWidth: number;
    readonly viewerHeight: number;
    readonly itemWidth: number;
    readonly itemHeight: number;
    readonly rotation?: ImageOrientation;
}

interface ImageRegionsState {
    readonly regionData?: RegionData;
}

export default class ImageRegions extends PureComponent<ImageRegionsProps, ImageRegionsState> {
    constructor(props: ImageRegionsProps) {
        super(props);
        this.state = {
            regionData: getRegionData(props.file)
        };
    }

    componentDidMount = async () => {};
    componentDidUpdate(
        prevProps: Readonly<ImageRegionsProps>,
        prevState: Readonly<ImageRegionsState>,
        snapshot?: any
    ): void {
        if (prevProps.file._id !== this.props.file._id) {
            const regionData = getRegionData(this.props.file);
            if (!regionData) {
                return this.setState({ regionData: undefined });
            }
            this.setState({ regionData });
        }
    }

    getContainedImagePosition = (
        itemWidth: number,
        itemHeight: number,
        viewerWidth: number,
        viewerHeight: number
    ) => {
        const imageRatio = itemWidth / itemHeight;
        const viewerRatio = viewerWidth / viewerHeight;
        let width = 0;
        let height = 0;
        let x = 0;
        let y = 0;
        if (imageRatio > viewerRatio) {
            width = viewerWidth;
            height = width / imageRatio;
            y = (viewerHeight - height) / 2;
        } else {
            height = viewerHeight;
            width = height * imageRatio;
            x = (viewerWidth - width) / 2;
        }

        if (
            this.props.rotation === ImageOrientation["Rotate 90 CW"] ||
            this.props.rotation === ImageOrientation["Rotate 270 CW"]
        ) {
            return { x: y, y: x, width: height, height: width };
        }

        return { x, y, width, height };
    };

    render = () => {
        console.log(this.state.regionData);
        console.log(this.props.file);

        const containedImagePosition = this.getContainedImagePosition(
            this.props.itemWidth,
            this.props.itemHeight,
            this.props.viewerWidth,
            this.props.viewerHeight
        );

        return (
            <div
                className="ImageRegions"
                style={{
                    //outline: "1px solid red",
                    width: this.props.viewerWidth,
                    height: this.props.viewerHeight,
                    position: "absolute"
                }}
            >
                <div
                    className="ImageRegionsImageContainer"
                    style={{
                        left: containedImagePosition.x,
                        top: containedImagePosition.y,
                        width: containedImagePosition.width,
                        height: containedImagePosition.height,
                        position: "relative",
                        outline: "1px solid orange"
                    }}
                >
                    {this.state.regionData?.regions?.map((region, i) => {
                        const defaultLeft = (region.x - region.width / 2) * 100 + "%";
                        const defaultTop = (region.y - region.height / 2) * 100 + "%";
                        const style = match(this.props.rotation)
                            .with(ImageOrientation["Horizontal (normal)"], () => ({
                                left: defaultLeft,
                                top: defaultTop,
                                width: region.width * containedImagePosition.width,
                                height: region.height * containedImagePosition.height
                            }))
                            .with(ImageOrientation["Rotate 90 CW"], () => ({
                                left: defaultTop,
                                top: defaultLeft,
                                width: region.width * containedImagePosition.height,
                                height: region.height * containedImagePosition.width
                            }))
                            .with(ImageOrientation["Rotate 180"], () => ({
                                left: defaultLeft,
                                top: defaultTop,
                                width: region.width * containedImagePosition.width,
                                height: region.height * containedImagePosition.height
                            }))
                            .with(ImageOrientation["Rotate 270 CW"], () => ({
                                left: defaultTop,
                                top: defaultLeft,
                                width: region.width * containedImagePosition.height,
                                height: region.height * containedImagePosition.width
                            }))
                            .otherwise(() => ({
                                left: defaultLeft,
                                top: defaultTop,
                                width: region.width * containedImagePosition.width,
                                height: region.height * containedImagePosition.height
                            }));
                        return (
                            <div
                                key={"ImageRegions" + i}
                                title={region.name}
                                style={{
                                    position: "absolute",

                                    outline: "1px solid red",
                                    zIndex: 3,
                                    ...style
                                }}
                            >
                                <span
                                    style={{
                                        fontSize: "8px",
                                        lineHeight: "8px",
                                        whiteSpace: "nowrap",
                                        background: "red"
                                    }}
                                >
                                    {region.name}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };
}

export interface RegionData {
    appliedDimensionHeight?: number; // RegionAppliedToDimensionsH
    appliedDimensionUnit?: string; // RegionAppliedToDimensionsUnit
    appliedDimensionWidth?: number; // RegionAppliedToDimensionsW
    extensions: {
        angleInfoRoll?: number; // RegionExtensionsAngleInfoRoll
        angleInfoYaw?: number; // RegionExtensionsAngleInfoYaw
        confidenceLevel?: number; // RegionExtensionsConfidenceLevel
        // id of face on apple device
        faceID?: number; // RegionExtensionsFaceID
    };
    regions?: SingleRegion[];
}

export interface SingleRegion {
    x: number; // RegionAreaX
    y: number; // RegionAreaY
    width: number; // RegionAreaW
    height: number; // RegionAreaH
    name: string; // RegionName
    type: string; // RegionType
    // the metadata gives this in radians, but we convert it to degrees
    rotation?: number; // RegionRotation
}

export const getRegionData = (file: FilezFile): RegionData | undefined => {
    const exifdata = file?.app_data?.metadata?.result?.exifdata;
    if (!exifdata) return;

    const regions: SingleRegion[] = [];

    if (isArray(exifdata.RegionAreaH)) {
        for (let i = 0; i < exifdata.RegionAreaH.length; i++) {
            regions.push({
                x: exifdata.RegionAreaX?.[i],
                y: exifdata.RegionAreaY?.[i],
                width: exifdata.RegionAreaW?.[i],
                height: exifdata.RegionAreaH?.[i],
                name: exifdata.RegionName?.[i],
                type: exifdata.RegionType?.[i],
                rotation: (exifdata.RegionRotation?.[i] * 180) / Math.PI
            });
        }
    } else if (typeof exifdata.RegionAreaH === "number") {
        regions.push({
            x: isArray(exifdata.RegionAreaX) ? exifdata.RegionAreaX?.[0] : exifdata.RegionAreaX,
            y: isArray(exifdata.RegionAreaY) ? exifdata.RegionAreaY?.[0] : exifdata.RegionAreaY,
            width: isArray(exifdata.RegionAreaW) ? exifdata.RegionAreaW?.[0] : exifdata.RegionAreaW,
            height: isArray(exifdata.RegionAreaH)
                ? exifdata.RegionAreaH?.[0]
                : exifdata.RegionAreaH,
            name: isArray(exifdata.RegionName) ? exifdata.RegionName?.[0] : exifdata.RegionName,
            type: isArray(exifdata.RegionType) ? exifdata.RegionType?.[0] : exifdata.RegionType,
            rotation:
                ((isArray(exifdata.RegionRotation)
                    ? exifdata.RegionRotation?.[0]
                    : exifdata.RegionRotation) *
                    180) /
                Math.PI
        });
    } else {
        return;
    }

    const region: RegionData = {
        appliedDimensionHeight: exifdata.RegionAppliedToDimensionsH,
        appliedDimensionUnit: exifdata.RegionAppliedToDimensionsUnit,
        appliedDimensionWidth: exifdata.RegionAppliedToDimensionsW,
        extensions: {
            angleInfoRoll: exifdata.RegionExtensionsAngleInfoRoll,
            angleInfoYaw: exifdata.RegionExtensionsAngleInfoYaw,
            confidenceLevel: exifdata.RegionExtensionsConfidenceLevel,
            faceID: exifdata.RegionExtensionsFaceID
        },
        regions
    };

    return region;
};
