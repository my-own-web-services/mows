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
    readonly regionInfo?: RegionInfo;
}

export default class ImageRegions extends PureComponent<ImageRegionsProps, ImageRegionsState> {
    constructor(props: ImageRegionsProps) {
        super(props);
        this.state = {
            regionInfo: this.getRegionInfo(this.props.file)
        };
    }

    getRegionInfo = (file: FilezFile) => {
        try {
            return convertRegionInfo(file.app_data?.metadata?.result?.exifdata.RegionInfo);
        } catch (error) {
            return undefined;
        }
    };

    componentDidMount = async () => {};
    componentDidUpdate(prevProps: Readonly<ImageRegionsProps>): void {
        if (prevProps.file._id !== this.props.file._id) {
            const regionInfo = this.getRegionInfo(this.props.file);
            if (!regionInfo) {
                return this.setState({ regionInfo: undefined });
            }
            this.setState({ regionInfo });
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
        console.log(this.state.regionInfo);

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
                    {this.state.regionInfo?.regionList?.map((region, i) => {
                        if (!region.area) {
                            return null;
                        }
                        const { w, h, x, y } = region.area;

                        const defaultLeft = (x - w / 2) * 100 + "%";
                        const defaultTop = (y - h / 2) * 100 + "%";
                        const style = match(this.props.rotation)
                            .with(ImageOrientation["Horizontal (normal)"], () => ({
                                left: defaultLeft,
                                top: defaultTop,
                                width: w * containedImagePosition.width,
                                height: h * containedImagePosition.height
                            }))
                            .with(ImageOrientation["Rotate 90 CW"], () => ({
                                left: defaultTop,
                                top: defaultLeft,
                                width: w * containedImagePosition.height,
                                height: h * containedImagePosition.width
                            }))
                            .with(ImageOrientation["Rotate 180"], () => ({
                                left: defaultLeft,
                                top: defaultTop,
                                width: w * containedImagePosition.width,
                                height: h * containedImagePosition.height
                            }))
                            .with(ImageOrientation["Rotate 270 CW"], () => ({
                                left: defaultTop,
                                top: defaultLeft,
                                width: w * containedImagePosition.height,
                                height: h * containedImagePosition.width
                            }))
                            .otherwise(() => ({
                                left: defaultLeft,
                                top: defaultTop,
                                width: w * containedImagePosition.width,
                                height: h * containedImagePosition.height
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

// convert the exiftool data to a more usable format
// convert strings to numbers
const convertRegionInfo = (regionInfo: RegionInfoExiftool | undefined): RegionInfo => {
    const regionList = regionInfo?.RegionList?.map(ret => {
        const area = ret.Area;

        const region: Region = {
            area: {
                h: ensureNumber(area?.H),
                w: ensureNumber(area?.W),
                x: ensureNumber(area?.X),
                y: ensureNumber(area?.Y)
            },
            name: ret.Name,
            rotation: ret.Rotation,
            type: ret.Type,
            extensions: {
                apple: {
                    fi: {
                        angleInfoRoll: ret?.Extensions?.["XMP-apple-fi:AngleInfoRoll"],
                        angleInfoYaw: ret?.Extensions?.["XMP-apple-fi:AngleInfoYaw"],
                        confidenceLevel: ret?.Extensions?.["XMP-apple-fi:ConfidenceLevel"],
                        faceID: ret?.Extensions?.["XMP-apple-fi:FaceID"]
                    }
                }
            }
        };
        return region;
    });

    const riatd = regionInfo?.AppliedToDimensions;
    return {
        appliedToDimensions: {
            h: ensureNumber(riatd?.H),
            w: ensureNumber(riatd?.W),
            unit: riatd?.Unit
        },
        regionList
    };
};

const ensureNumber = (n: number | string | undefined) => {
    if (typeof n === "string") {
        return Number(n);
    } else if (typeof n === "undefined") {
        throw new Error("undefined");
    }
    return n;
};

export interface RegionInfo {
    appliedToDimensions?: AppliedToDimensions;
    regionList?: Region[];
}

export interface AppliedToDimensions {
    h?: number;
    w?: number;
    unit?: string;
}

export interface Region {
    area?: RegionArea;
    rotation?: number;
    type?: string;
    name?: string;
    extensions: {
        apple: {
            fi: {
                // face recognition data from apple devices
                angleInfoRoll?: number;
                angleInfoYaw?: number;
                confidenceLevel?: number;
                faceID?: number;
            };
        };
    };
}

export interface RegionArea {
    h: number;
    w: number;
    x: number;
    y: number;
}

export interface RegionInfoExiftool {
    AppliedToDimensions?: AppliedToDimensionsExiftool;
    RegionList?: RegionExiftool[];
}

export interface AppliedToDimensionsExiftool {
    H?: number;
    W?: number;
    Unit?: string;
}

export interface RegionExiftool {
    Area?: RegionAreaExiftool;
    Rotation?: number;
    Type?: string;
    Name?: string;
    Extensions?: {
        // face recognition data from apple devices
        "XMP-apple-fi:AngleInfoRoll"?: number;
        "XMP-apple-fi:AngleInfoYaw"?: number;
        "XMP-apple-fi:ConfidenceLevel"?: number;
        "XMP-apple-fi:FaceID"?: number;
    };
}

export interface RegionAreaExiftool {
    H?: number | string;
    W?: number | string;
    X?: number | string;
    Y?: number | string;
}
