import { Component } from "preact";

import TableOfContents from "./project/TableOfContents";
import WorkInProgress from "./project/sections/WorkInProgress";
import Hero from "./project/sections/what/Hero";
import Overview from "./project/sections/what/Overview";
import WhyProblems from "./project/sections/why/WhyProblems";
import WhyDifferent from "./project/sections/why/WhyDifferent";
import FiveParts from "./project/sections/how/FiveParts";

//                <TableOfContents />

interface ProjectProps {}
interface ProjectState {}
export default class Project extends Component<ProjectProps, ProjectState> {
    componentDidMount = () => {};

    render = () => {
        return (
            <main className="Project mb-20">
                <TableOfContents mode="desktop" />
                <Hero />

                <div id="Introduction">
                    <Overview />
                    <WhyDifferent />
                </div>

                <div id="Why">
                    <WhyProblems />
                </div>

                <div id="How">
                    <FiveParts />
                </div>

                <WorkInProgress />
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
