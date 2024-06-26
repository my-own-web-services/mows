import { Component } from "preact";
import anime from "animejs/lib/anime.es.js";
import AnyMachineSVG from "../../assets/any_machine.svg";
import ReactVirtualizedAutoSizer from "react-virtualized-auto-sizer";
import { animationsEnabled } from "../Nav";

interface AnimLine {
    value: string;
    delay?: number;
    duration?: number;
    easing?: string;
}

const defaultParams = {
    delay: 1000,
    duration: 1000,
    easing: "easeInOutQuint"
};

const animLines: AnimLine[] = [
    {
        value: "461,607 630,386 286,079 499,492 286,079 431,784 227,526 398,387 227,420 330,234 168,918 296,738 110,520 330,101 110,614 397,072 52,214 430,877 52,214 499,664 110,614 533,113 168,918 499,333 227,526 533,636 286,079 499,492"
    },
    {
        value: "461,607 630,386 519,232 498,506 520,074 431,936 461,466 397,633 403,162 431,413 403,162 431,413 344,762 397,964 344,762 329,177 403,162 295,372 460,195 329,822 519,543 295,794 520,245 228,289 577,193 195,021 636,421 229,022 695,080 194,701 752,897 228,855 753,808 295,362 695,667 329,751 695,020 396,820 636,305 430,687 636,458 497,818 578,259 531,856 519,232 498,506"
    },
    {
        value: "461,607 630,386 519,232 498,506 520,074 431,936 461,466 397,633 403,162 431,413 403,162 431,413 344,762 397,964 344,762 329,177 403,162 295,372 460,195 329,822 519,543 295,794 520,245 228,289 460,766 193,693 461,559 127,204 518,554 93,372 577,929 128,161 635,965 94,575 695,506 128,386 753,736 93,989 812,881 127,701 812,224 194,888 870,898 228,209 870,768 296,714 812,332 329,108 753,808 295,362 695,667 329,751 695,020 396,820 636,305 430,687 636,458 497,818 578,259 531,856 519,232 498,506"
    },
    {
        value: "461,607 630,386 461,835 647,322 477,661 638,468 493,985 647,764 494,262 667,519 478,214 676,595 478,325 694,911 461,447 704,817 444,681 695,188 444,515 676,705 428,578 667,686 428,301 648,539 445,068 639,077 461,835 647,322"
    },
    {
        value: "461,607 630,386 286,079 499,492 286,079 431,784 227,526 398,387 227,420 330,234 168,918 296,738 110,520 330,101 110,614 397,072 52,214 430,877 52,214 499,664 110,614 533,113 168,918 499,333 227,526 533,636 286,079 499,492"
    }
];

const convertPositions = (lines: AnimLine[], first?: boolean): AnimLine[] => {
    // get the point count of the longest line
    const pointCount = Math.max(...lines.map(l => l.value.split(" ").length));

    // extend the shorter lines to match the longest line by repeating the last point this means the last two numbers
    const extendedLines = lines.map(l => {
        const points = l.value.split(" ");

        const lastPoint = points[points.length - 2] + " " + points[points.length - 1] + " ";
        return {
            ...defaultParams,
            ...l,
            value: (l.value + " " + lastPoint.repeat(pointCount - points.length / 2))
                .replace(/,/g, ".")
                .trimEnd()
        };
    });

    // return the first line if first is true
    if (first) return extendedLines;

    // return the other lines
    return extendedLines.slice(1);
};

interface AnyMachineProps {
    readonly style?: any;
    readonly loop?: boolean;
    readonly className?: string;
}
interface AnyMachineState {}
export default class AnyMachine extends Component<AnyMachineProps, AnyMachineState> {
    id: number;
    constructor(props: AnyMachineProps) {
        super(props);
        this.id = Math.floor(Math.random() * 1000000);
    }

    componentDidMount = () => {
        if (this.props.loop) {
            this.runAnimation(true);
        }
    };

    runAnimation = async (loop?: boolean) => {
        const targets = `.AnyMachineOverlay${this.id}`;

        const animation = anime({
            targets,
            points: convertPositions(animLines),
            loop
        });

        animationsEnabled.subscribe(enabled => {
            if (enabled) {
                animation.play();
            } else {
                animation.pause();
            }
        });

        if (animation.animatables.length === 0) {
            // await Promise setTimeout
            await new Promise(resolve => setTimeout(resolve, 10));

            this.runAnimation(loop);
        }
    };

    render = () => {
        const imageWidth = 922.71301;
        const imageHeight = 727.6778;
        const aspectRatio = imageWidth / imageHeight;

        return (
            <div className={`AnyMachine ${this.props.className}`}>
                <ReactVirtualizedAutoSizer>
                    {parentSize => {
                        const { width, height, top, left } = (() => {
                            if (parentSize.width / aspectRatio > parentSize.height) {
                                return {
                                    width: parentSize.height * aspectRatio,
                                    height: parentSize.height,
                                    top: 0,
                                    left: (parentSize.width - parentSize.height * aspectRatio) / 2
                                };
                            } else {
                                return {
                                    width: parentSize.width,
                                    height: parentSize.width / aspectRatio,
                                    top: (parentSize.height - parentSize.width / aspectRatio) / 2,
                                    left: 0
                                };
                            }
                        })();

                        return (
                            <div
                                style={{
                                    position: "relative",
                                    top,
                                    left,
                                    width,
                                    height
                                }}
                            >
                                <svg
                                    style={{
                                        position: "absolute",
                                        top: 0,
                                        left: 0,
                                        zIndex: 1
                                    }}
                                    width={width}
                                    height={height}
                                    viewBox={`0 0 ${imageWidth} ${imageHeight}`}
                                    version="1.1"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <polygon
                                        className={`AnyMachineOverlay${this.id}`}
                                        stroke={"var(--c-hl2)"}
                                        fill="none"
                                        stroke-width={5}
                                        points={convertPositions(animLines, true)[0].value}
                                    />
                                </svg>
                                <img
                                    style={{
                                        position: "absolute",
                                        top: 0,
                                        left: 0
                                    }}
                                    width={width}
                                    height={height}
                                    src={AnyMachineSVG}
                                    alt=""
                                />
                            </div>
                        );
                    }}
                </ReactVirtualizedAutoSizer>
            </div>
        );
    };
}
