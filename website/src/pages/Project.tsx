import { Component } from "preact";
import Face from "../assets/face.jpg";
import basics from "../assets/basics.svg";
import HashNavLink from "../components/HashNavLink";
import Background from "../components/Background";
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
                    <div className={"Face"}>
                        <img draggable={false} src={Face} alt="" />
                    </div>
                </section>
                <section className={"Basics"}>
                    <div className={"basicsTop"}>
                        <HashNavLink className={"Basics"}>
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
                    <div className={"basicsLine"}>
                        <img draggable={false} className={"glow"} src={basics} alt="" />
                        <div style={{ top: -25, left: 200, width: 430 }}>
                            <HashNavLink className={"BasicsEasyToUse"}>
                                <h2>Easy to use</h2>
                            </HashNavLink>
                            <p className={"largeText"}>
                                MOWS is designed to be easy to setup, use and operate. It is
                                designed to be usable by everyone, on every device, everywhere.
                            </p>
                        </div>
                        <div style={{ top: 155, left: 295, width: 470 }}>
                            <HashNavLink className={"BasicsReliable"}>
                                <h2>Reliable</h2>
                            </HashNavLink>
                            <p className={"largeText"}>
                                As MOWS is built to run across multiple computers it is highly
                                reliable, to keep on working after a failure even when you are not
                                around.
                            </p>
                        </div>

                        <div style={{ top: 330, left: 200, width: 576 }}>
                            <HashNavLink className={"BasicsSecure"}>
                                <h2>Secure</h2>
                            </HashNavLink>
                            <p className={"largeText"}>
                                Application isolation is at the core of the MOWS ecosystem, ensuring
                                that no bit can escape your control. Full encryption at rest ensures
                                that your data cannot be stolen physically.
                            </p>
                        </div>
                        <div style={{ top: 500, left: 400, width: 530 }}>
                            <HashNavLink className={"BasicsPrivate"}>
                                <h2>Private</h2>
                            </HashNavLink>
                            <p className={"largeText"}>
                                Reclaim privacy by storing your data locally again, while not losing
                                the amenities of modern web applications that are usable on and
                                synced to every device.
                            </p>
                        </div>

                        <div style={{ top: 680, left: 295, width: 554 }}>
                            <HashNavLink className={"BasicsOpen"}>
                                <h2>Open</h2>
                            </HashNavLink>
                            <p className={"largeText"}>
                                The open nature of MOWS makes it impossible to get locked in to one
                                provider. No centralized app store can tell you what to do. MOWS is
                                licensed under GNU AGPL v3.
                            </p>
                        </div>
                        <div style={{ top: 850, left: 295, width: 464 }}>
                            <HashNavLink className={"BasicsDeveloperFriendly"}>
                                <h2>Developer Friendly</h2>
                            </HashNavLink>
                            <p className={"largeText"}>
                                MOWS streamlines app development by offering a variety of essential
                                APIs, sparing developers from repetitive, cluttered groundwork.
                            </p>
                        </div>
                        <div style={{ top: 1030, left: 200, width: 652 }}>
                            <HashNavLink className={"BasicsComprehensive"}>
                                <h2>Comprehensive</h2>
                            </HashNavLink>
                            <p className={"largeText"}>
                                MOWS is a holistic solution for a lot of challenges in the current
                                software ecosystem regarding privacy, ease of use, compatibility,
                                reliability, easy privacy preserving app development and many more.
                            </p>
                        </div>
                        <div style={{ top: 1208, left: 295, width: 559 }}>
                            <HashNavLink className={"BasicsScalable"}>
                                <h2>Scalable</h2>
                            </HashNavLink>
                            <p className={"largeText"}>
                                No matter if you are starting in a home lab or in a data center,
                                MOWS scales with your needs. It is designed to run on multiple
                                computers but can also run on a single one.
                            </p>
                        </div>
                    </div>
                </section>
            </div>
        );
    };
}
