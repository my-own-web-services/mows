import { Component } from "preact";
import Face from "../assets/face.jpg";

interface ProjectProps {}
interface ProjectState {}
export default class Project extends Component<ProjectProps, ProjectState> {
    render = () => {
        return (
            <div className="Project">
                <section className={"Hero"}>
                    <div className={"HeroText"}>
                        <h1>
                            <span>Leave the dark clouds behind and</span>
                            <span className={"hl1"}> create your own!</span>
                        </h1>
                        <p className={"largeText"}>
                            Break free from the confines of tech giants' locked-in cloud
                            surveillance systems while enjoying the easy, worry-free operation of
                            your own cloud environment. Reclaim your privacy and sovereignty with
                            ease by using MOWS.
                        </p>
                    </div>
                    <img className={"Face"} src={Face} alt="" />
                </section>
                <section className={"Basics"}></section>
            </div>
        );
    };
}
