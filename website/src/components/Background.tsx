import { Component } from "preact";
import Hex from "../assets/hex.svg";
import AutoSizer from "react-virtualized-auto-sizer";

interface BackgroundProps {}
interface BackgroundState {}

const hWidth = 100;
const hHeight = 85;
const maxWidth = 1400;

export default class Background extends Component<BackgroundProps, BackgroundState> {
    render = () => {
        return (
            <div className="Background">
                <div>
                    <AutoSizer>
                        {({ width }) => {
                            const hexes = [];
                            for (let y = 0; y < 15; y++) {
                                const evenRow = y % 2 === 0;

                                for (let x = 0; x < 20; x++) {
                                    hexes.push(
                                        <img
                                            draggable={false}
                                            style={{
                                                position: "absolute",
                                                left:
                                                    (evenRow
                                                        ? x * hWidth
                                                        : x * hWidth + hWidth / 2) -
                                                    hWidth / 2,
                                                top: y * hHeight - hHeight / 2,
                                                contentVisibility: "auto",
                                                opacity: Math.round(Math.random() + 0.25) + "%"
                                            }}
                                            src={Hex}
                                            alt="background"
                                        />
                                    );
                                }
                            }
                            return <div style={{ width }}>{hexes}</div>;
                        }}
                    </AutoSizer>
                </div>
            </div>
        );
    };
}

/*
                    <div className={"blender left"}></div>
                    <div className={"blender right"}></div>
*/
