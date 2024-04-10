import { Component } from "preact";
import Face from "../assets/face.jpg";
import HashNavLink from "../components/HashNavLink";
//import AnyMachine from "../components/animations/AnyMachine";

import Why from "./project/sections/Why";
import ClusterNodeFailure from "../components/animations/ClusterNodeFailure";
import Progress from "./project/sections/Progress";
import ManyParts from "./project/sections/HowManyParts";
import TableOfContents from "./project/TableOfContents";
import How from "./project/sections/How";
import WorkInProgress from "./project/sections/WorkInProgress";

//                <TableOfContents />

interface ProjectProps {}
interface ProjectState {}
export default class Project extends Component<ProjectProps, ProjectState> {
    componentDidMount = () => {};

    render = () => {
        return (
            <main className="Project">
                <section className={"Hero"} id="Hero">
                    <div className={"HeroSplit"}>
                        <div className={"HeroText"}>
                            <h1>
                                <div>Leave the Dark Clouds Behind and</div>

                                <div className={"hl1"}> Create Your Own!</div>
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
                <section className={"MOWS"} id="MOWS">
                    <div className="subsection childrenCenterFlex">
                        <div>
                            <HashNavLink className={"MOWS"}>
                                <h1>My Own Web Services</h1>
                            </HashNavLink>
                            <h2 className={"hl1"}>The Cloud OS with Batteries Included</h2>
                            <p className={"largeText"}>
                                MOWS makes it easy to start your own multi-computer cloud system
                                from scratch. Perfect for businesses, individuals, and beyond. It
                                can run on your own or rented hardware. It offers an open solution,
                                but still has you covered on all operational basics so you can focus
                                on what truly matters.
                            </p>
                        </div>
                        <ClusterNodeFailure />
                    </div>
                </section>

                <WorkInProgress style={{ width: "100%" }} />

                <Why />

                <How />
            </main>
        );
    };
}

//                 <AnyMachine />
/*this of course does not work because of cors
        fetch("https://git.vindelicum.eu/firstdorsal/mows/-/graphs/main/charts").then(v =>
            v.text().then(t => {
                const beginToken = "Authors: <strong>";
                const endToken = "</strong>";
                const t1 = t.substring(t.indexOf(beginToken) + beginToken.length);
                const t2 = t1.substring(0, t1.indexOf(endToken));
                console.log(t2);
            })
        );
*/
