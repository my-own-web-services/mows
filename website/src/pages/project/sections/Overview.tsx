import { Component } from "preact";
import HashNavLink from "../../../components/HashNavLink";
import ClusterNodeFailure from "../../../components/animations/ClusterNodeFailure";
import { CSSProperties } from "react";

interface OverviewProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly id?: string;
}
interface OverviewState {}
export default class Overview extends Component<OverviewProps, OverviewState> {
    render = () => {
        return (
            <section id="Overview" className={`Overview ${this.props.className ?? ""}`}>
                <div className="flex flex-col lg:flex-row content-center justify-center md:gap-10">
                    <div className={"w-5/5 lg:w-4/5 pb-12 md:pb-0"}>
                        <HashNavLink className={"Overview"}>
                            <h1>My Own Web Services</h1>
                        </HashNavLink>
                        <h3 className={"hl1 -mt-4"}>
                            The power of the cloud put back in your hands
                        </h3>
                        <p className={"largeText"}>
                            MOWS [maʊz] makes it easy to start your own multi-computer cloud system
                            from scratch. It is not just another home server OS, as it provides
                            powerful APIs, reliability and strong isolation through the use of the
                            extensible and ever growing Kubernetes ecosystem. It can run on your own
                            or rented hardware. It offers an open solution, but still has you
                            covered on all operational basics.
                        </p>
                    </div>
                    <ClusterNodeFailure loop className={"lg:w-1/5 lg:mt-16 lg:-ml-10"} />
                </div>
            </section>
        );
    };
}
