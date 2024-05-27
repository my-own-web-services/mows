import { Component } from "preact";

import TableOfContents from "./project/TableOfContents";
import Hero from "./project/sections/Hero";
import Overview from "./project/sections/Overview";
import WhyProblems from "./project/sections/why/Problems";
import WhyDifferent from "./project/sections/what/Differences";
import FiveParts from "./project/sections/how/FiveParts";
import Contribute from "./project/sections/contribute/Contribute";
import Progress from "./project/sections/Progress";
import FAQ from "./project/sections/FAQ";
import What from "./project/sections/what/Possibilities";
import Possibilities from "./project/sections/what/Possibilities";
import Differences from "./project/sections/what/Differences";
import Problems from "./project/sections/why/Problems";
import Story from "./project/sections/why/Story";

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

                <div className={"w-full"} id="What">
                    <Overview className="intersect" />
                    <Possibilities className={"mt-48 intersect"} id="WhatPossibilities" />
                    <Differences className={"mt-48 intersect"} id="WhatDifferences" />
                </div>

                <div className={"w-full"} id="Why">
                    <Problems id="WhyProblems" className="intersect mt-48" />
                    <Story id="WhyStory" />
                </div>

                <div className={"w-full mt-32"} id="How">
                    <FiveParts id="HowFiveParts" />
                    {/* Built on the shoulders of giants */}
                </div>
                <Contribute className={"w-full"} id={"Contribute"} />
                <Progress className={"w-full intersect"} id={"Progress"} />
                <FAQ className={"w-full mt-20 intersect"} id={"FAQ"} />
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
