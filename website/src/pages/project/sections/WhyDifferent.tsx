import { Component } from "preact";
import HashNavLink from "../../../components/HashNavLink";
import basics from "../../../assets/basics.svg";

interface WhyDifferentProps {}
interface WhyDifferentState {}
export default class WhyDifferent extends Component<WhyDifferentProps, WhyDifferentState> {
    render = () => {
        return (
            <div className={"subsection"} id="WhyDifferent">
                <HashNavLink className={"WhyDifferent"}>
                    <h2>
                        What Makes <span className={"hl1"}>MOWS</span> Different?
                    </h2>
                </HashNavLink>
                <div className={"basicsLine"}>
                    <img
                        width={352}
                        height={1406}
                        draggable={false}
                        className={"glow"}
                        src={basics}
                        alt=""
                    />
                    <div>
                        <div className={"WhyDifferentEasyToUse"}>
                            <HashNavLink className={"WhyDifferentEasyToUse"}>
                                <h3>Easy to Use</h3>
                            </HashNavLink>
                            <p>
                                MOWS is designed to be easy to set up and operate. It's designed to
                                be usable by everyone, on any device, everywhere.
                            </p>
                        </div>
                        <div className={"WhyDifferentReliable"}>
                            <HashNavLink className={"WhyDifferentReliable"}>
                                <h3>Reliable</h3>
                            </HashNavLink>
                            <p>
                                MOWS is built to run across multiple computers, so it's highly
                                reliable, and designed to keep on working after a failure, even when
                                you are not around.
                            </p>
                        </div>

                        <div className={"WhyDifferentSecure"}>
                            <HashNavLink className={"WhyDifferentSecure"}>
                                <h3>Secure</h3>
                            </HashNavLink>
                            <p>
                                Application isolation is at the core of the MOWS ecosystem, ensuring
                                that no bit can escape your control. Full encryption at rest ensures
                                that your data cannot be stolen physically.
                            </p>
                        </div>
                        <div className={"WhyDifferentPrivate"}>
                            <HashNavLink className={"WhyDifferentPrivate"}>
                                <h3>Private</h3>
                            </HashNavLink>
                            <p>
                                Reclaim privacy by storing your data locally again, while not losing
                                the amenities of modern web applications that are usable
                                on&mdash;and synced to&mdash;every device.
                            </p>
                        </div>

                        <div className={"WhyDifferentOpen"}>
                            <HashNavLink className={"WhyDifferentOpen"}>
                                <h3>Open</h3>
                            </HashNavLink>
                            <p>
                                The open nature of MOWS makes it impossible to get locked in to one
                                provider. No centralized app store can tell you what to do. MOWS is
                                licensed under GNU AGPL v3.
                            </p>
                        </div>
                        <div className={"WhyDifferentDeveloperFriendly"}>
                            <HashNavLink className={"WhyDifferentDeveloperFriendly"}>
                                <h3>Developer-Friendly</h3>
                            </HashNavLink>
                            <p>
                                MOWS streamlines app development by offering a variety of essential
                                APIs, sparing developers repetitive, cluttered groundwork while
                                creating awesome integrated web services.
                            </p>
                        </div>
                        <div className={"WhyDifferentComprehensive"}>
                            <HashNavLink className={"WhyDifferentComprehensive"}>
                                <h3>Comprehensive</h3>
                            </HashNavLink>
                            <p>
                                MOWS is a holistic solution for a lot of challenges in the current
                                software ecosystem regarding privacy, ease of use, compatibility,
                                reliability, easy app development (while preserving privacy) and
                                many more.
                            </p>
                        </div>
                        <div className={"WhyDifferentScalable"}>
                            <HashNavLink className={"WhyDifferentScalable"}>
                                <h3>Scalable</h3>
                            </HashNavLink>
                            <p>
                                No matter if you are starting in a home lab or in a data center,
                                MOWS scales with your needs. It is designed to run on multiple
                                computers but can also run on a single one. MOWS can run on any
                                machine that can run Linux.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    };
}
