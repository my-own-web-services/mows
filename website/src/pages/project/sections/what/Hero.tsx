import { Component } from "preact";
import Face from "../../../../assets/face.jpg";
interface HeroProps {}
interface HeroState {}
export default class Hero extends Component<HeroProps, HeroState> {
    render = () => {
        return (
            <section className={"Hero"} id="Hero">
                <div className={"HeroSplit"}>
                    <div className={"HeroText"}>
                        <h1>
                            <div>Leave All the Dark Clouds Behind and</div>

                            <div className={"hl1"}>Run Your Own!</div>
                        </h1>
                        <p className={"largeText"}>
                            Break free from the confines of tech giants' locked-in cloud
                            surveillance systems, while still enjoying the easy, worry-free
                            operation of your own cloud environment. Reclaim your privacy and
                            sovereignty by using MOWS.
                        </p>
                    </div>
                    <div className={"Face"}>
                        <img height={1100} width={967} draggable={false} src={Face} alt="" />
                    </div>
                </div>
            </section>
        );
    };
}
