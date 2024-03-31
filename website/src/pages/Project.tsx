import { Component } from "preact";
import Face from "../assets/face.jpg";
import HashNavLink from "../components/HashNavLink";
//import AnyMachine from "../components/animations/AnyMachine";

import FourParts from "./project/sections/FourParts";
import Why from "./project/sections/Why";
import ClusterNodeFailure from "../components/animations/ClusterNodeFailure";

interface ProjectProps {}
interface ProjectState {}
export default class Project extends Component<ProjectProps, ProjectState> {
    componentDidMount = () => {};

    render = () => {
        return (
            <main className="Project">
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
                    <div className={"Face"}>
                        <img height={1100} width={967} draggable={false} src={Face} alt="" />
                    </div>
                </section>
                <section className={"MOWS"}>
                    <div>
                        <HashNavLink className={"MOWS"}>
                            <h1>My Own Web Services</h1>
                        </HashNavLink>
                        <h2 className={"hl1"}>The cloud OS with batteries included</h2>
                        <p className={"largeText"}>
                            MOWS makes it easy to start your own multi-computer cloud system from
                            scratch. Perfect for businesses, individuals, and beyond, it enables
                            effortless empowerment in reclaiming data sovereignty and privacy. It
                            offers an open solution but still has you covered on all operational
                            basics, to let you focus on what truly matters.
                        </p>
                    </div>
                    <div>
                        <ClusterNodeFailure style={{ width: "200px" }} />
                    </div>
                </section>

                <Why />

                <FourParts />

                <h1>To be continued</h1>
            </main>
        );
    };
}

//                 <AnyMachine />
