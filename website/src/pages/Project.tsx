import { Component } from "preact";

import TableOfContents from "./project/TableOfContents";
import WorkInProgress from "./project/sections/contribute/WorkInProgress";
import Hero from "./project/sections/what/Hero";
import Overview from "./project/sections/what/Overview";
import WhyProblems from "./project/sections/why/WhyProblems";
import WhyDifferent from "./project/sections/what/WhyDifferent";
import FiveParts from "./project/sections/how/FiveParts";
import Contribute from "./project/sections/contribute/Contribute";
import Progress from "./project/sections/Progress";
import FAQ from "./project/sections/FAQ";
import What from "./project/sections/what/What";
import WhySolutions from "./project/sections/why/WhySolutions";

//                <TableOfContents />

interface ProjectProps {}
interface ProjectState {}
export default class Project extends Component<ProjectProps, ProjectState> {
    componentDidMount = () => {};

    render = () => {
        return (
            <main className="Project mb-20 w-full min-h-[100vh] px-5 md:px-20 flex flex-col justify-center items-center">
                <TableOfContents mode="desktop" />
                <Hero />

                <div className={"w-full"} id="Overview">
                    <Overview />
                    <What className={"mt-48"} />
                    <WhyDifferent className={"mt-48"} />
                </div>

                <div className={"w-full"} id="Why">
                    <WhyProblems />
                    {/* Motivation */}
                </div>

                <div className={"w-full"} id="How">
                    <FiveParts />
                    {/* Built on the shoulders of giants */}
                </div>
                <div className={"w-full"} id="Contribute">
                    <Contribute className={"w-full"} />
                </div>
                <Progress className={"w-full"} />
                <FAQ className={"w-full mt-20"} />
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
