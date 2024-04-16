import { Component } from "preact";
import HashNavLink from "../../../../components/HashNavLink";
import ClusterNodeFailure from "../../../../components/animations/ClusterNodeFailure";

interface OverviewProps {}
interface OverviewState {}
export default class Overview extends Component<OverviewProps, OverviewState> {
    render = () => {
        return (
            <section className={"Overview"} id="Overview">
                <div className="flex flex-col lg:flex-row content-center justify-center gap-10">
                    <div className={"w-5/5 lg:w-4/5"}>
                        <HashNavLink className={"Overview"}>
                            <h1>My Own Web Services</h1>
                        </HashNavLink>
                        <h2 className={"hl1"}>The Cloud OS with Batteries Included</h2>
                        <p className={"largeText"}>
                            MOWS makes it easy to start your own multi-computer cloud system from
                            scratch. Perfect for businesses, individuals, and beyond. It can run on
                            your own or rented hardware. It offers an open solution, but still has
                            you covered on all operational basics so you can focus on what truly
                            matters.
                        </p>
                    </div>
                    <ClusterNodeFailure className={"lg:w-1/5 lg:mt-5 lg:-ml-10 "} />
                </div>
            </section>
        );
    };
}
