import { PureComponent } from "react";
import OpenSeaDragon from "openseadragon";
import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";
import { FilezContext } from "../../FilezProvider";
import { ProcessedImage } from "@firstdorsal/filez-client/dist/js/apiTypes/ProcessedImage";
interface ZoomImageProps {
    file: FilezFile;
}

interface ZoomImageState {}

export default class ZoomImage extends PureComponent<
    ZoomImageProps,
    ZoomImageState
> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    openSeaDragon: OpenSeaDragon.Viewer | null = null;
    constructor(props: ZoomImageProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {
        this.createSeadragon();
    };

    componentDidUpdate = async (prevProps: ZoomImageProps) => {
        if (prevProps.file._id !== this.props.file._id) {
            this.updateImage();
        }
    };

    updateImage = () => {
        this.openSeaDragon?.destroy();
        this.createSeadragon();
    };

    createSeadragon = () => {
        const serverUrl = this.context?.uiConfig?.filezServerAddress;
        if (!serverUrl) return;
        const f = this.props.file;
        const processedImage = f.app_data?.image?.result as ProcessedImage;
        if (!processedImage) return;

        const dzi = processedImage?.dzi;
        if (!dzi) return;

        this.openSeaDragon = OpenSeaDragon({
            id: "openseadragon",
            ajaxWithCredentials: true,
            tileSources: {
                Image: {
                    Format: dzi.format,
                    Overlap: dzi.tile_overlap.toString(),
                    Size: {
                        Height: processedImage.height.toString(),
                        Width: processedImage.width.toString()
                    },
                    TileSize: dzi.tile_size.toString(),
                    Url: `${serverUrl}/api/file/get/${f._id}/image/dzi/`,
                    xmlns: "http://schemas.microsoft.com/deepzoom/2008"
                }
            },
            animationTime: 0,
            showNavigationControl: false,
            maxZoomPixelRatio: 2,
            zoomPerClick: 1,
            imageSmoothingEnabled: true,
            defaultZoomLevel: 1
        });
    };

    render = () => {
        return (
            <div
                className="ZoomImage"
                style={{ width: "100%", height: "100%" }}
            >
                <div
                    id="openseadragon"
                    style={{ width: "100%", height: "100%" }}
                 />
            </div>
        );
    };
}
