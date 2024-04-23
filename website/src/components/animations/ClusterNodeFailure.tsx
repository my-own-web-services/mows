import anime from "animejs";
import { Component } from "preact";
import { CSSProperties } from "react";
import { animationsEnabled } from "../Nav";

interface ClusterNodeFailureProps {
    readonly style?: CSSProperties;
    readonly loop?: boolean;
    readonly className?: string;
}
interface ClusterNodeFailureState {
    readonly reloadKey: number;
}

const width = 239.8653;
const height = 243.82852;
const vWidth = 63.464356;
const vHeight = 64.512963;

const wScale = width / vWidth;
const hScale = height / vHeight;

export default class ClusterNodeFailure extends Component<
    ClusterNodeFailureProps,
    ClusterNodeFailureState
> {
    id: number;
    constructor(props: ClusterNodeFailureProps) {
        super(props);
        this.id = Math.floor(Math.random() * 1000000);
    }

    componentDidMount = () => {
        if (this.props.loop) {
            this.runAnimation(true);
        }
    };

    runAnimation = async (loop?: boolean) => {
        const currentClassName = `.ClusterNodeFailure${this.id}`;
        const appearTime = 500;

        const animation = (() =>
            anime
                .timeline({
                    easing: "easeInOutQuad",
                    loop
                })
                .add({
                    duration: 500
                })
                .add({
                    targets: `${currentClassName} #g5`,
                    duration: 300,
                    opacity: [1, 0.1]
                })
                .add({
                    targets: `${currentClassName} #g5`,
                    duration: 200,
                    opacity: [1, 0.1]
                })
                .add({
                    targets: `${currentClassName} #g5`,
                    duration: 100,
                    opacity: [1, 0.1]
                })
                .add({
                    duration: 500
                })
                .add({
                    targets: [`${currentClassName} #g198-9`, `${currentClassName}  #g198-0`],
                    duration: 1000,
                    opacity: [1, 0.5, 1, 0.5, 1, 0.5, 1]
                })

                .add({
                    targets: `${currentClassName} #path3-5-2-66-12-0-3-57`,
                    opacity: [0, 1],
                    duration: appearTime
                })
                .add({
                    targets: `${currentClassName} #path3-5-9-0-7-0-2-6-8`,
                    opacity: [0, 1],
                    duration: appearTime
                })
                .add({
                    targets: `${currentClassName} #path3-5-9-0-7-0-2-6-8-3`,
                    opacity: [0, 1],
                    duration: appearTime
                })
                .add({
                    targets: `${currentClassName} #path3-5-2-8-26-5-1-8-24`,
                    opacity: [0, 1],
                    duration: appearTime
                })
                .add({
                    targets: `${currentClassName} #path3-5-2-66-12-0-3-5`,
                    opacity: [0, 1],
                    duration: appearTime
                })
                .add({
                    targets: `${currentClassName} #path3-5-4-8-97-8-7-1`,
                    opacity: [0, 1],
                    duration: appearTime
                })

                .add({
                    targets: `${currentClassName} #path3-5-40-51-3-3-9`,
                    opacity: [0, 1],
                    duration: appearTime
                })
                .add({
                    targets: `${currentClassName} #path3-5-2-8-64-4-5-26-4`,
                    opacity: [0, 1],
                    duration: appearTime
                })

                .add({
                    targets: `${currentClassName} #path195-47-0-9-0`,
                    opacity: [0, 1],
                    duration: appearTime
                })
                .add({
                    duration: 500
                })
                .add({
                    duration: 2000,
                    targets: `${currentClassName} #path197-0-2-1`,
                    translateY: (-1 * (145.565 - 44.302)) / hScale,
                    translateX: (-1 * (211.081 - 152.784)) / wScale
                })
                .add({
                    delay: 1000
                }))();

        animationsEnabled.subscribe(enabled => {
            if (enabled) {
                animation.play();
            } else {
                animation.pause();
            }
        });
    };

    render = () => {
        return (
            <div
                className={`ClusterNodeFailure ClusterNodeFailure${this.id} ${this.props.className}`}
                style={this.props.style}
            >
                <div
                    style={{
                        width,
                        height,
                        margin: "auto"
                    }}
                >
                    <svg
                        width="239.8653"
                        height="243.82852"
                        viewBox="0 0 63.464356 64.512963"
                        version="1.1"
                        id="svg1"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <defs id="defs1" />
                        <g
                            id="layer1"
                            style="display:inline;opacity:1"
                            transform="translate(-322.85465,132.02955)"
                        >
                            <g id="g6" style="opacity:1">
                                <path
                                    style="display:inline;opacity:0;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 361.78715,-82.087146 v -4.06935 l 3.52416,2.034676 -3.52416,2.034674"
                                    id="path3-5-2-66-12-0-3-57"
                                />
                                <path
                                    style="display:inline;opacity:0;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 361.08233,-91.446653 -3.52416,2.03468 v -4.06935 l 3.52416,2.03467"
                                    id="path3-5-9-0-7-0-2-6-8"
                                />
                                <path
                                    style="display:inline;opacity:0;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 373.79563,-74.335386 -3.52416,2.03468 v -4.06935 l 3.52416,2.03467"
                                    id="path3-5-9-0-7-0-2-6-8-3"
                                />
                                <path
                                    style="display:inline;opacity:0;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 357.79505,-93.904573 3.52415,-2.03468 v 4.06935 l -3.52415,-2.03467"
                                    id="path3-5-2-8-26-5-1-8-24"
                                />
                                <path
                                    style="display:inline;opacity:0;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 361.76085,-87.128243 v -4.06935 l 3.52416,2.034676 -3.52416,2.034674"
                                    id="path3-5-2-66-12-0-3-5"
                                />
                                <path
                                    style="display:inline;opacity:0;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 357.55817,-88.598104 3.52416,2.034674 -3.52416,2.034674 v -4.069348"
                                    id="path3-5-4-8-97-8-7-1"
                                />
                                <path
                                    style="display:inline;opacity:0;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 366.29746,-98.886134 3.52416,-2.034666 v 4.069341 l -3.52416,-2.034675"
                                    id="path3-5-40-51-3-3-9"
                                />
                                <path
                                    style="display:inline;opacity:0;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 357.79504,-89.021353 3.52415,-2.034676 v 4.069351 l -3.52415,-2.034675"
                                    id="path3-5-2-8-64-4-5-26-4"
                                />
                                <path
                                    style="display:inline;opacity:0;fill:#00797f;fill-opacity:1;stroke:none;stroke-width:0.143669;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 365.76351,-98.630403 -3.98357,2.28827 0.003,4.62571 4.00553,2.29627 3.99093,-2.30169 0.005,-4.59566 z"
                                    id="path195-47-0-9-0"
                                />
                            </g>
                            <path
                                style="display:inline;fill:none;fill-opacity:1;stroke:#d5d5d5;stroke-width:2.15727;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                id="path1-5-6-6-7-7-0-7"
                                d="m 67.052309,41.5333 20.959925,36.30365 -20.959921,36.30365 -41.919846,0 L 4.1725426,77.836954 25.132464,41.533302 Z"
                                transform="matrix(0.31864632,0.18397054,-0.18397054,0.31864632,354.21935,-146.64639)"
                            />
                            <path
                                style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                d="m 346.36281,-108.08229 3.52416,2.03467 -3.52416,2.03467 v -4.06934"
                                id="path3-6-5-7-5-5"
                            />
                            <path
                                style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                d="m 354.11597,-103.60601 -3.52416,2.03468 v -4.06935 l 3.52416,2.03467"
                                id="path3-5-9-0-7-0-2-6"
                            />
                            <path
                                style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                d="m 350.12384,-105.657 v 4.06935 l -3.52416,-2.03468 3.52416,-2.03467"
                                id="path3-5-90-3-0-6-13-9"
                            />
                            <path
                                style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                d="m 350.82869,-106.06393 3.52415,-2.03468 v 4.06935 l -3.52415,-2.03467"
                                id="path3-5-2-8-26-5-1-8"
                            />
                            <path
                                style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                d="m 355.05769,-103.63864 3.52415,-2.03468 v 4.06935 l -3.52415,-2.03467"
                                id="path3-5-2-8-26-5-1-8-28"
                            />
                            <path
                                style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                d="m 354.8208,-99.129729 v -4.069351 l 3.52417,2.03468 -3.52417,2.034671"
                                id="path3-5-2-3-1-5-3-7"
                            />
                            <path
                                style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                d="m 350.82869,-101.18072 3.52415,-2.03467 v 4.069347 l -3.52415,-2.034677"
                                id="path3-5-2-8-26-8-1-89-8"
                            />
                            <path
                                style="display:inline;fill:none;fill-opacity:1;stroke:#d5d5d5;stroke-width:2.15727;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                id="path1-5-6-6-7-7-0-3"
                                d="m 67.052309,41.5333 20.959925,36.30365 -20.959921,36.30365 -41.919846,0 L 4.1725426,77.836954 25.132464,41.533302 Z"
                                transform="matrix(0.31864632,0.18397054,-0.18397054,0.31864632,369.6437,-119.85369)"
                            />
                            <path
                                style="display:inline;fill:#aaff00;fill-opacity:1;stroke:none;stroke-width:0.264583;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                d="m 382.49261,-79.676707 0.004,-13.838693 -3.79147,2.17195 -0.002,9.47872 z"
                                id="path197-0-2"
                            />
                            <path
                                style="display:inline;fill:#aaff00;fill-opacity:1;stroke:none;stroke-width:0.264592;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                d="m 382.49274,-79.676248 0.004,-13.839152 -3.7916,2.172022 -0.002,9.479033 z"
                                id="path197-0-2-1"
                            />
                            <path
                                style="display:inline;fill:none;fill-opacity:1;stroke:#d5d5d5;stroke-width:2.15727;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                id="path1-5-6-6-7-7-1-9"
                                d="m 67.052309,41.5333 20.959925,36.30365 -20.959921,36.30365 -41.919846,0 L 4.1725426,77.836954 25.132464,41.533302 Z"
                                transform="matrix(0,0.36794108,-0.36794108,0,398.65058,-103.53087)"
                            />
                            <path
                                style="display:inline;fill:#dc00ff;fill-opacity:1;stroke:none;stroke-width:0.264583;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                d="m 382.22915,-93.898328 -11.98276,-6.922632 -0.0148,4.369481 8.20776,4.741179 z"
                                id="path197-6"
                            />
                            <path
                                style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                d="m 357.55816,-83.714885 3.52416,2.034674 -3.52416,2.034674 v -4.069348"
                                id="path3-5-4-8-97-0"
                            />
                            <path
                                style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                d="m 357.79503,-84.138134 3.52415,-2.034676 v 4.069351 l -3.52415,-2.034675"
                                id="path3-5-2-8-64-4-8"
                            />
                            <path
                                style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                d="m 361.31918,-77.220241 -3.52416,-2.034675 3.52416,-2.034674 v 4.069349"
                                id="path3-5-9-2-3-1-9-0"
                            />
                            <path
                                style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                d="m 361.78716,-81.289585 3.52416,2.034674 -3.52416,2.034674 v -4.069348"
                                id="path3-6-5-7-5-6"
                            />
                            <path
                                style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                d="m 369.54032,-76.813302 -3.52416,2.034676 v -4.06935 l 3.52416,2.034674"
                                id="path3-5-9-0-7-0-2-4"
                            />
                            <path
                                style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                d="m 365.54819,-78.864295 v 4.069351 l -3.52416,-2.034676 3.52416,-2.034675"
                                id="path3-5-90-3-0-6-13-6"
                            />
                            <path
                                style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                d="m 365.54818,-83.739355 v 4.06935 l -3.52416,-2.034676 3.52416,-2.034674"
                                id="path3-5-90-8-3-8-0-0-2"
                            />
                            <path
                                style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                d="m 366.25304,-74.388007 3.52415,-2.034675 v 4.06935 l -3.52415,-2.034675"
                                id="path3-5-2-8-26-8-1-89-5"
                            />
                            <path
                                style="display:inline;fill:#dc00ff;fill-opacity:1;stroke:none;stroke-width:0.264583;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                d="m 354.35067,-127.60874 -11.98656,6.91605 3.7767,2.19754 8.20986,-4.73755 z"
                                id="path197-8"
                            />
                            <g id="g5" style="display:inline">
                                <path
                                    style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 326.61433,-88.579046 3.52416,2.034675 -3.52416,2.034674 v -4.069349"
                                    id="path3-5-40-51-3-3"
                                />
                                <path
                                    style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 326.61433,-83.695827 3.52416,2.034674 -3.52416,2.034674 v -4.069348"
                                    id="path3-5-4-8-97-8-7"
                                />
                                <path
                                    style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 330.84332,-82.068088 v -4.06935 l 3.52416,2.034676 -3.52416,2.034674"
                                    id="path3-5-2-66-12-0-3"
                                />
                                <path
                                    style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 326.8512,-84.119076 3.52415,-2.034676 v 4.069351 l -3.52415,-2.034675"
                                    id="path3-5-2-8-64-4-5-26"
                                />
                                <path
                                    style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 330.37535,-77.201183 -3.52416,-2.034675 3.52416,-2.034674 v 4.069349"
                                    id="path3-5-9-2-3-1-9-6-5"
                                />
                                <path
                                    style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 339.30132,-72.31796 v -4.06935 l 3.52417,2.034675 -3.52417,2.034675"
                                    id="path3-5-2-3-1-5-3-6-2"
                                />
                                <path
                                    style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 343.06235,-74.775883 -3.52416,-2.034675 3.52416,-2.034674 v 4.069349"
                                    id="path3-5-9-2-73-7-4-3-4-65"
                                />
                                <path
                                    style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 335.30921,-74.368949 3.52415,-2.034675 v 4.06935 l -3.52415,-2.034675"
                                    id="path3-5-2-8-26-8-1-89-0-87"
                                />
                                <path
                                    style="display:inline;fill:#00797f;fill-opacity:1;stroke:none;stroke-width:0.143669;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 334.83881,-83.870018 -3.98357,2.288274 0.003,4.625709 4.00553,2.296266 3.99093,-2.301691 0.005,-4.595656 z"
                                    id="path195-47-0-9"
                                />
                                <path
                                    style="display:inline;fill:none;fill-opacity:1;stroke:#d5d5d5;stroke-width:2.15727;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    id="path1-5-6-6-7-7-1-4"
                                    d="m 67.052309,41.5333 20.959925,36.30365 -20.959921,36.30365 -41.919846,0 L 4.1725426,77.836954 25.132464,41.533302 Z"
                                    transform="matrix(0.31864632,0.18397054,-0.18397054,0.31864632,338.69987,-119.83463)"
                                />
                                <path
                                    style="display:inline;fill:#aaff00;fill-opacity:1;stroke:none;stroke-width:0.264583;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 338.83118,-100.79698 -11.98656,6.916052 3.7767,2.197535 8.20986,-4.737545 z"
                                    id="path197-18"
                                />
                                <g
                                    id="g198-5"
                                    style="display:inline"
                                    transform="translate(63.632768,-54.318621)"
                                >
                                    <path
                                        style="fill:#ff0000;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                        d="m 270.97159,-30.207397 -3.52416,-2.034676 3.52416,-2.034674 v 4.06935"
                                        id="path3-5-9-2-9-3-3"
                                    />
                                    <path
                                        style="fill:#0199ff;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                        d="m 271.43957,-34.276742 3.52416,2.034674 -3.52416,2.034675 v -4.069349"
                                        id="path3-6-4-8-9"
                                    />
                                    <path
                                        style="fill:#00797f;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                        d="m 279.19273,-29.800458 -3.52417,2.034675 v -4.06935 l 3.52417,2.034675"
                                        id="path3-5-9-0-9-9-4"
                                    />
                                    <path
                                        style="fill:#f8c517;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                        d="m 275.2006,-31.851451 v 4.069351 l -3.52417,-2.034677 3.52417,-2.034674"
                                        id="path3-5-90-3-4-6-8"
                                    />
                                    <path
                                        style="fill:#531c3c;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                        d="m 275.20059,-36.726512 v 4.069351 l -3.52417,-2.034676 3.52417,-2.034675"
                                        id="path3-5-90-8-3-9-06-12"
                                    />
                                    <path
                                        style="fill:#326de6;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                        d="m 275.66855,-36.702038 3.52417,2.034675 -3.52417,2.034674 v -4.069349"
                                        id="path3-5-6-8-9-2-9"
                                    />
                                    <path
                                        style="fill:#aaff00;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                        d="m 279.89755,-30.19108 v -4.06935 l 3.52416,2.034676 -3.52416,2.034674"
                                        id="path3-5-2-6-6-8-09-3"
                                    />
                                    <path
                                        style="fill:#ff0074;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                        d="m 275.90543,-32.242069 3.52415,-2.034675 v 4.069351 l -3.52415,-2.034676"
                                        id="path3-5-2-8-2-1-3-3-9"
                                    />
                                    <path
                                        style="fill:none;fill-opacity:1;stroke:#0199ff;stroke-width:0.79375;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                        d="m 275.42293,-37.141919 -8.48533,4.907329 8.5142,4.879034 8.49823,-4.864275 z"
                                        id="path196-6"
                                    />
                                </g>
                                <path
                                    style="display:inline;fill:none;fill-opacity:1;stroke:#d5d5d5;stroke-width:2.15727;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    id="path1-5-6-6-7-7-0-7-2"
                                    d="m 67.052309,41.5333 20.959925,36.30365 -20.959921,36.30365 -41.919846,0 L 4.1725426,77.836954 25.132464,41.533302 Z"
                                    transform="matrix(0.31864632,0.18397054,-0.18397054,0.31864632,463.16468,-146.11475)"
                                />
                                <path
                                    style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 455.30814,-107.55065 3.52416,2.03467 -3.52416,2.03467 v -4.06934"
                                    id="path3-6-5-7-5-5-0"
                                />
                                <path
                                    style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 463.0613,-103.07437 -3.52416,2.03468 v -4.06935 l 3.52416,2.03467"
                                    id="path3-5-9-0-7-0-2-6-5"
                                />
                                <path
                                    style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 459.06917,-105.12536 v 4.06935 l -3.52416,-2.03468 3.52416,-2.03467"
                                    id="path3-5-90-3-0-6-13-9-5"
                                />
                                <path
                                    style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 459.77402,-105.53229 3.52415,-2.03468 v 4.06935 l -3.52415,-2.03467"
                                    id="path3-5-2-8-26-5-1-8-2"
                                />
                                <path
                                    style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 463.76613,-98.598091 v -4.069349 l 3.52417,2.03468 -3.52417,2.034669"
                                    id="path3-5-2-3-1-5-3-7-9"
                                />
                                <path
                                    style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 467.52716,-101.05601 -3.52416,-2.03467 3.52416,-2.03468 v 4.06935"
                                    id="path3-5-9-2-73-7-4-3-2-0"
                                />
                                <path
                                    style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 459.77402,-100.64908 3.52415,-2.03467 v 4.069345 l -3.52415,-2.034675"
                                    id="path3-5-2-8-26-8-1-89-8-2"
                                />
                                <path
                                    style="display:inline;fill:none;fill-opacity:1;stroke:#d5d5d5;stroke-width:2.15727;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    id="path1-5-6-6-7-7-0-3-8"
                                    d="m 67.052309,41.5333 20.959925,36.30365 -20.959921,36.30365 -41.919846,0 L 4.1725426,77.836954 25.132464,41.533302 Z"
                                    transform="matrix(0.31864632,0.18397054,-0.18397054,0.31864632,478.58903,-119.32205)"
                                />
                                <path
                                    style="display:inline;fill:#aaff00;fill-opacity:1;stroke:none;stroke-width:0.264583;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 491.43794,-79.145069 0.004,-13.838693 -3.79147,2.17195 -0.002,9.47872 z"
                                    id="path197-0-2-3"
                                />
                                <path
                                    style="display:inline;fill:#aaff00;fill-opacity:1;stroke:none;stroke-width:0.264592;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 491.43807,-79.14461 0.004,-13.839152 -3.7916,2.172022 -0.002,9.479033 z"
                                    id="path197-0-2-1-8"
                                />
                                <path
                                    style="display:inline;fill:none;fill-opacity:1;stroke:#d5d5d5;stroke-width:2.15727;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    id="path1-5-6-6-7-7-1-9-0"
                                    d="m 67.052309,41.5333 20.959925,36.30365 -20.959921,36.30365 -41.919846,0 L 4.1725426,77.836954 25.132464,41.533302 Z"
                                    transform="matrix(0,0.36794108,-0.36794108,0,507.59591,-102.99923)"
                                />
                                <path
                                    style="display:inline;fill:#aaff00;fill-opacity:1;stroke:none;stroke-width:0.264584;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 476.01359,-105.93758 0.004,-13.83876 -3.79147,2.17196 -0.002,9.47877 z"
                                    id="path197-0-2-1-7-4"
                                />
                                <path
                                    style="display:inline;fill:#dc00ff;fill-opacity:1;stroke:none;stroke-width:0.264583;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 491.17448,-93.36669 -11.98276,-6.92263 -0.0148,4.369479 8.20776,4.741179 z"
                                    id="path197-6-0"
                                />
                                <path
                                    style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 466.50349,-83.183247 3.52416,2.034674 -3.52416,2.034674 v -4.069348"
                                    id="path3-5-4-8-97-0-9"
                                />
                                <path
                                    style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 466.74036,-83.606496 3.52415,-2.034676 v 4.069351 l -3.52415,-2.034675"
                                    id="path3-5-2-8-64-4-8-1"
                                />
                                <path
                                    style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 470.26451,-76.688603 -3.52416,-2.034675 3.52416,-2.034674 v 4.069349"
                                    id="path3-5-9-2-3-1-9-0-9"
                                />
                                <path
                                    style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 470.73249,-80.757947 3.52416,2.034674 -3.52416,2.034674 v -4.069348"
                                    id="path3-6-5-7-5-6-6"
                                />
                                <path
                                    style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 478.48565,-76.281664 -3.52416,2.034676 v -4.06935 l 3.52416,2.034674"
                                    id="path3-5-9-0-7-0-2-4-2"
                                />
                                <path
                                    style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 474.49352,-78.332657 v 4.069351 l -3.52416,-2.034676 3.52416,-2.034675"
                                    id="path3-5-90-3-0-6-13-6-5"
                                />
                                <path
                                    style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 474.49351,-83.207717 v 4.06935 l -3.52416,-2.034676 3.52416,-2.034674"
                                    id="path3-5-90-8-3-8-0-0-2-4"
                                />
                                <path
                                    style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 475.19837,-73.856369 3.52415,-2.034675 v 4.06935 l -3.52415,-2.034675"
                                    id="path3-5-2-8-26-8-1-89-5-4"
                                />
                                <path
                                    style="display:inline;fill:#dc00ff;fill-opacity:1;stroke:none;stroke-width:0.264583;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 463.296,-127.0771 -11.98656,6.91605 3.7767,2.19754 8.20986,-4.73755 z"
                                    id="path197-8-9"
                                />
                                <g
                                    id="g198-0-9"
                                    style="display:inline"
                                    transform="translate(203.52192,-53.806044)"
                                >
                                    <path
                                        style="fill:#ff0000;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                        d="m 270.97159,-30.207397 -3.52416,-2.034676 3.52416,-2.034674 v 4.06935"
                                        id="path3-5-9-2-9-3-1-3"
                                    />
                                    <path
                                        style="fill:#0199ff;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                        d="m 271.43957,-34.276742 3.52416,2.034674 -3.52416,2.034675 v -4.069349"
                                        id="path3-6-4-8-7-6"
                                    />
                                    <path
                                        style="fill:#00797f;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                        d="m 279.19273,-29.800458 -3.52417,2.034675 v -4.06935 l 3.52417,2.034675"
                                        id="path3-5-9-0-9-9-7-0"
                                    />
                                    <path
                                        style="fill:#f8c517;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                        d="m 275.2006,-31.851451 v 4.069351 l -3.52417,-2.034677 3.52417,-2.034674"
                                        id="path3-5-90-3-4-6-1-5"
                                    />
                                    <path
                                        style="fill:#531c3c;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                        d="m 275.20059,-36.726512 v 4.069351 l -3.52417,-2.034676 3.52417,-2.034675"
                                        id="path3-5-90-8-3-9-06-1-0"
                                    />
                                    <path
                                        style="fill:#326de6;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                        d="m 275.66855,-36.702038 3.52417,2.034675 -3.52417,2.034674 v -4.069349"
                                        id="path3-5-6-8-9-2-5-2"
                                    />
                                    <path
                                        style="fill:#aaff00;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                        d="m 279.89755,-30.19108 v -4.06935 l 3.52416,2.034676 -3.52416,2.034674"
                                        id="path3-5-2-6-6-8-09-9-9"
                                    />
                                    <path
                                        style="fill:#ff0074;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                        d="m 275.90543,-32.242069 3.52415,-2.034675 v 4.069351 l -3.52415,-2.034676"
                                        id="path3-5-2-8-2-1-3-3-7-4"
                                    />
                                    <path
                                        style="fill:none;fill-opacity:1;stroke:#0199ff;stroke-width:0.79375;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                        d="m 275.42293,-37.141919 -8.48533,4.907329 8.5142,4.879034 8.49823,-4.864275 z"
                                        id="path196-9-3"
                                    />
                                </g>
                                <g
                                    id="g198-9-5"
                                    style="display:inline"
                                    transform="translate(188.09758,-80.598736)"
                                >
                                    <path
                                        style="fill:#ff0000;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                        d="m 270.97159,-30.207397 -3.52416,-2.034676 3.52416,-2.034674 v 4.06935"
                                        id="path3-5-9-2-9-3-8-1"
                                    />
                                    <path
                                        style="fill:#0199ff;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                        d="m 271.43957,-34.276742 3.52416,2.034674 -3.52416,2.034675 v -4.069349"
                                        id="path3-6-4-8-5-7"
                                    />
                                    <path
                                        style="fill:#00797f;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                        d="m 279.19273,-29.800458 -3.52417,2.034675 v -4.06935 l 3.52417,2.034675"
                                        id="path3-5-9-0-9-9-6-4"
                                    />
                                    <path
                                        style="fill:#f8c517;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                        d="m 275.2006,-31.851451 v 4.069351 l -3.52417,-2.034677 3.52417,-2.034674"
                                        id="path3-5-90-3-4-6-11-3"
                                    />
                                    <path
                                        style="fill:#531c3c;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                        d="m 275.20059,-36.726512 v 4.069351 l -3.52417,-2.034676 3.52417,-2.034675"
                                        id="path3-5-90-8-3-9-06-5-1"
                                    />
                                    <path
                                        style="fill:#326de6;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                        d="m 275.66855,-36.702038 3.52417,2.034675 -3.52417,2.034674 v -4.069349"
                                        id="path3-5-6-8-9-2-98-4"
                                    />
                                    <path
                                        style="fill:#aaff00;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                        d="m 279.89755,-30.19108 v -4.06935 l 3.52416,2.034676 -3.52416,2.034674"
                                        id="path3-5-2-6-6-8-09-4-6"
                                    />
                                    <path
                                        style="fill:#ff0074;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                        d="m 275.90543,-32.242069 3.52415,-2.034675 v 4.069351 l -3.52415,-2.034676"
                                        id="path3-5-2-8-2-1-3-3-81-9"
                                    />
                                    <path
                                        style="fill:none;fill-opacity:1;stroke:#0199ff;stroke-width:0.79375;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                        d="m 275.42293,-37.141919 -8.48533,4.907329 8.5142,4.879034 8.49823,-4.864275 z"
                                        id="path196-63-4"
                                    />
                                </g>
                                <path
                                    style="display:inline;fill:none;fill-opacity:1;stroke:#0199ff;stroke-width:1.5875;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 463.47166,-130.58351 15.47871,8.86246 0.0281,18.03224 15.4921,8.836181 2e-5,17.914297 -15.49212,9.0341 -15.50682,-9.07609 -15.42615,8.93756 -15.45175,-8.84991 -2e-5,-18.199857 15.45177,-8.944421 -0.025,-17.71923 z"
                                    id="path198-1-4-2"
                                />
                                <path
                                    style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 435.55966,-88.047408 3.52416,2.034675 -3.52416,2.034674 v -4.069349"
                                    id="path3-5-40-51-3-6"
                                />
                                <path
                                    style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 435.55966,-83.164189 3.52416,2.034674 -3.52416,2.034674 v -4.069348"
                                    id="path3-5-4-8-97-8-4"
                                />
                                <path
                                    style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 439.78865,-81.53645 v -4.06935 l 3.52416,2.034676 -3.52416,2.034674"
                                    id="path3-5-2-66-12-0-1"
                                />
                                <path
                                    style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 435.79653,-83.587438 3.52415,-2.034676 v 4.069351 l -3.52415,-2.034675"
                                    id="path3-5-2-8-64-4-5-2"
                                />
                                <path
                                    style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 439.32068,-76.669545 -3.52416,-2.034675 3.52416,-2.034674 v 4.069349"
                                    id="path3-5-9-2-3-1-9-6-8"
                                />
                                <path
                                    style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 448.24665,-71.786322 v -4.06935 l 3.52417,2.034675 -3.52417,2.034675"
                                    id="path3-5-2-3-1-5-3-6-8"
                                />
                                <path
                                    style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 452.00768,-74.244245 -3.52416,-2.034675 3.52416,-2.034674 v 4.069349"
                                    id="path3-5-9-2-73-7-4-3-4-9"
                                />
                                <path
                                    style="display:inline;fill:#ff3a16;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 444.25454,-73.837311 3.52415,-2.034675 v 4.06935 l -3.52415,-2.034675"
                                    id="path3-5-2-8-26-8-1-89-0-2"
                                />
                                <path
                                    style="display:inline;fill:#00797f;fill-opacity:1;stroke:none;stroke-width:0.143669;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 443.78414,-83.33838 -3.98357,2.288274 0.003,4.625709 4.00553,2.296266 3.99093,-2.301691 0.005,-4.595656 z"
                                    id="path195-47-0-8"
                                />
                                <path
                                    style="display:inline;fill:none;fill-opacity:1;stroke:#d5d5d5;stroke-width:2.15727;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    id="path1-5-6-6-7-7-1-4-8"
                                    d="m 67.052309,41.5333 20.959925,36.30365 -20.959921,36.30365 -41.919846,0 L 4.1725426,77.836954 25.132464,41.533302 Z"
                                    transform="matrix(0.31864632,0.18397054,-0.18397054,0.31864632,447.6452,-119.30299)"
                                />
                                <path
                                    style="display:inline;fill:#aaff00;fill-opacity:1;stroke:none;stroke-width:0.264583;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 447.77651,-100.26534 -11.98656,6.91605 3.7767,2.197535 8.20986,-4.737545 z"
                                    id="path197-18-8"
                                />
                                <g
                                    id="g198-5-6"
                                    style="display:inline"
                                    transform="translate(172.5781,-53.786983)"
                                >
                                    <path
                                        style="fill:#ff0000;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                        d="m 270.97159,-30.207397 -3.52416,-2.034676 3.52416,-2.034674 v 4.06935"
                                        id="path3-5-9-2-9-3-3-8"
                                    />
                                    <path
                                        style="fill:#0199ff;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                        d="m 271.43957,-34.276742 3.52416,2.034674 -3.52416,2.034675 v -4.069349"
                                        id="path3-6-4-8-9-3"
                                    />
                                    <path
                                        style="fill:#00797f;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                        d="m 279.19273,-29.800458 -3.52417,2.034675 v -4.06935 l 3.52417,2.034675"
                                        id="path3-5-9-0-9-9-4-8"
                                    />
                                    <path
                                        style="fill:#f8c517;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                        d="m 275.2006,-31.851451 v 4.069351 l -3.52417,-2.034677 3.52417,-2.034674"
                                        id="path3-5-90-3-4-6-8-3"
                                    />
                                    <path
                                        style="fill:#531c3c;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                        d="m 275.20059,-36.726512 v 4.069351 l -3.52417,-2.034676 3.52417,-2.034675"
                                        id="path3-5-90-8-3-9-06-12-3"
                                    />
                                    <path
                                        style="fill:#326de6;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                        d="m 275.66855,-36.702038 3.52417,2.034675 -3.52417,2.034674 v -4.069349"
                                        id="path3-5-6-8-9-2-9-3"
                                    />
                                    <path
                                        style="fill:#aaff00;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                        d="m 279.89755,-30.19108 v -4.06935 l 3.52416,2.034676 -3.52416,2.034674"
                                        id="path3-5-2-6-6-8-09-3-8"
                                    />
                                    <path
                                        style="fill:#ff0074;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                        d="m 275.90543,-32.242069 3.52415,-2.034675 v 4.069351 l -3.52415,-2.034676"
                                        id="path3-5-2-8-2-1-3-3-9-0"
                                    />
                                    <path
                                        style="fill:none;fill-opacity:1;stroke:#0199ff;stroke-width:0.79375;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                        d="m 275.42293,-37.141919 -8.48533,4.907329 8.5142,4.879034 8.49823,-4.864275 z"
                                        id="path196-6-4"
                                    />
                                </g>
                            </g>
                            <g
                                id="g198-9"
                                style="display:inline"
                                transform="translate(79.152247,-81.130374)"
                            >
                                <path
                                    style="fill:#ff0000;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 270.97159,-30.207397 -3.52416,-2.034676 3.52416,-2.034674 v 4.06935"
                                    id="path3-5-9-2-9-3-8"
                                />
                                <path
                                    style="fill:#0199ff;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 271.43957,-34.276742 3.52416,2.034674 -3.52416,2.034675 v -4.069349"
                                    id="path3-6-4-8-5"
                                />
                                <path
                                    style="fill:#00797f;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 279.19273,-29.800458 -3.52417,2.034675 v -4.06935 l 3.52417,2.034675"
                                    id="path3-5-9-0-9-9-6"
                                />
                                <path
                                    style="fill:#f8c517;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 275.2006,-31.851451 v 4.069351 l -3.52417,-2.034677 3.52417,-2.034674"
                                    id="path3-5-90-3-4-6-11"
                                />
                                <path
                                    style="fill:#531c3c;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 275.20059,-36.726512 v 4.069351 l -3.52417,-2.034676 3.52417,-2.034675"
                                    id="path3-5-90-8-3-9-06-5"
                                />
                                <path
                                    style="fill:#326de6;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 275.66855,-36.702038 3.52417,2.034675 -3.52417,2.034674 v -4.069349"
                                    id="path3-5-6-8-9-2-98"
                                />
                                <path
                                    style="fill:#aaff00;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 279.89755,-30.19108 v -4.06935 l 3.52416,2.034676 -3.52416,2.034674"
                                    id="path3-5-2-6-6-8-09-4"
                                />
                                <path
                                    style="fill:#ff0074;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 275.90543,-32.242069 3.52415,-2.034675 v 4.069351 l -3.52415,-2.034676"
                                    id="path3-5-2-8-2-1-3-3-81"
                                />
                                <path
                                    style="fill:none;fill-opacity:1;stroke:#0199ff;stroke-width:0.79375;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 275.42293,-37.141919 -8.48533,4.907329 8.5142,4.879034 8.49823,-4.864275 z"
                                    id="path196-63"
                                />
                            </g>
                            <path
                                style="display:inline;fill:none;fill-opacity:1;stroke:#0199ff;stroke-width:1.5875;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                d="m 354.52633,-131.11515 15.47871,8.86246 0.0281,18.03224 15.4921,8.836183 2e-5,17.914297 -15.49212,9.0341 -15.50682,-9.07609 -15.42615,8.93756 -15.45175,-8.84991 -2e-5,-18.199857 15.45177,-8.944423 -0.025,-17.71923 z"
                                id="path198-1-4"
                            />
                            <g
                                id="g198-0"
                                style="display:inline"
                                transform="translate(94.576593,-54.337682)"
                            >
                                <path
                                    style="fill:#ff0000;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 270.97159,-30.207397 -3.52416,-2.034676 3.52416,-2.034674 v 4.06935"
                                    id="path3-5-9-2-9-3-1"
                                />
                                <path
                                    style="fill:#0199ff;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 271.43957,-34.276742 3.52416,2.034674 -3.52416,2.034675 v -4.069349"
                                    id="path3-6-4-8-7"
                                />
                                <path
                                    style="fill:#00797f;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 279.19273,-29.800458 -3.52417,2.034675 v -4.06935 l 3.52417,2.034675"
                                    id="path3-5-9-0-9-9-7"
                                />
                                <path
                                    style="fill:#f8c517;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 275.2006,-31.851451 v 4.069351 l -3.52417,-2.034677 3.52417,-2.034674"
                                    id="path3-5-90-3-4-6-1"
                                />
                                <path
                                    style="fill:#531c3c;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 275.20059,-36.726512 v 4.069351 l -3.52417,-2.034676 3.52417,-2.034675"
                                    id="path3-5-90-8-3-9-06-1"
                                />
                                <path
                                    style="fill:#326de6;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 275.66855,-36.702038 3.52417,2.034675 -3.52417,2.034674 v -4.069349"
                                    id="path3-5-6-8-9-2-5"
                                />
                                <path
                                    style="fill:#aaff00;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 279.89755,-30.19108 v -4.06935 l 3.52416,2.034676 -3.52416,2.034674"
                                    id="path3-5-2-6-6-8-09-9"
                                />
                                <path
                                    style="fill:#ff0074;fill-opacity:1;stroke:none;stroke-width:0.147311;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 275.90543,-32.242069 3.52415,-2.034675 v 4.069351 l -3.52415,-2.034676"
                                    id="path3-5-2-8-2-1-3-3-7"
                                />
                                <path
                                    style="fill:none;fill-opacity:1;stroke:#0199ff;stroke-width:0.79375;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
                                    d="m 275.42293,-37.141919 -8.48533,4.907329 8.5142,4.879034 8.49823,-4.864275 z"
                                    id="path196-9"
                                />
                            </g>
                        </g>
                    </svg>
                </div>
            </div>
        );
    };
}
