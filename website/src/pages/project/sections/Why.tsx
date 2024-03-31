import { Component } from "preact";
import HashNavLink from "../../../components/HashNavLink";
import basics from "../../../assets/basics.svg";
import ArchitectureProblems from "../ArchitectureProblems";
//@ts-ignore
import Fortnite1984Image from "./assets/fortnite.png?w=500&format=webp&as=metadata";
//@ts-ignore
import CamerasImage from "./assets/cameras.png?w=500&format=webp&as=metadata";

import Image from "../../../components/Image";

interface WhyProps {}
interface WhyState {}
export default class Why extends Component<WhyProps, WhyState> {
    render = () => {
        return (
            <section className={"Why"}>
                <div className={"subsection"}>
                    <HashNavLink className={"WhyProblems"}>
                        <h2>Problems with current cloud architectures</h2>
                    </HashNavLink>

                    <ArchitectureProblems />
                </div>
                <div className={"subsection"}>
                    <HashNavLink className={"WhyDifferent"}>
                        <h2>
                            What makes <span className={"hl1"}>MOWS</span> different?
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
                        <div style={{ top: 0, left: 200, width: 332 }}>
                            <HashNavLink className={"WhyDifferentEasyToUse"}>
                                <h3>Easy to use</h3>
                            </HashNavLink>
                            <p>
                                MOWS is designed to be easy to setup, use and operate. It is
                                designed to be usable by everyone, on every device, everywhere.
                            </p>
                        </div>
                        <div style={{ top: 177, left: 295, width: 380 }}>
                            <HashNavLink className={"WhyDifferentReliable"}>
                                <h3>Reliable</h3>
                            </HashNavLink>
                            <p>
                                As MOWS is built to run across multiple computers it is highly
                                reliable, to keep on working after a failure even when you are not
                                around.
                            </p>
                        </div>

                        <div style={{ top: 360, left: 200, width: 456 }}>
                            <HashNavLink className={"WhyDifferentSecure"}>
                                <h3>Secure</h3>
                            </HashNavLink>
                            <p>
                                Application isolation is at the core of the MOWS ecosystem, ensuring
                                that no bit can escape your control. Full encryption at rest ensures
                                that your data cannot be stolen physically.
                            </p>
                        </div>
                        <div style={{ top: 525, left: 400, width: 422 }}>
                            <HashNavLink className={"WhyDifferentPrivate"}>
                                <h3>Private</h3>
                            </HashNavLink>
                            <p>
                                Reclaim privacy by storing your data locally again, while not losing
                                the amenities of modern web applications that are usable on and
                                synced to every device.
                            </p>
                        </div>

                        <div style={{ top: 700, left: 295, width: 441 }}>
                            <HashNavLink className={"WhyDifferentOpen"}>
                                <h3>Open</h3>
                            </HashNavLink>
                            <p>
                                The open nature of MOWS makes it impossible to get locked in to one
                                provider. No centralized app store can tell you what to do. MOWS is
                                licensed under GNU AGPL v3.
                            </p>
                        </div>
                        <div style={{ top: 875, left: 295, width: 370 }}>
                            <HashNavLink className={"WhyDifferentDeveloperFriendly"}>
                                <h3>Developer Friendly</h3>
                            </HashNavLink>
                            <p>
                                MOWS streamlines app development by offering a variety of essential
                                APIs, sparing developers from repetitive, cluttered groundwork while
                                creating awesome integrated web services.
                            </p>
                        </div>
                        <div style={{ top: 1052, left: 200, width: 550 }}>
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
                        <div style={{ top: 1230, left: 295, width: 574 }}>
                            <HashNavLink className={"WhyDifferentScalable"}>
                                <h3>Scalable</h3>
                            </HashNavLink>
                            <p>
                                No matter if you are starting in a home lab or in a data center,
                                MOWS scales with your needs. It is designed to run on multiple
                                computers but can also run on a single one. MOWS can run on every
                                machine that can run Linux.
                            </p>
                        </div>
                    </div>
                </div>
                <div className={"subsection solutions"}>
                    <HashNavLink className={"WhySolutions"}>
                        <h2>All about solutions</h2>
                        <h3 className={"hl1 centered"}>How MOWS was born</h3>
                    </HashNavLink>
                    <div className={"childrenSideBySide"}>
                        <div>
                            <HashNavLink className={"WhySolutionsPrivacy"}>
                                <h3>Privacy and Sovereignty</h3>
                            </HashNavLink>
                            <div>
                                <h4>Problem</h4>

                                <p>
                                    The current IT landscape is in pieces. Big tech has thoroughly
                                    vanquished their users privacy, sovereignty and choices. <br />
                                    <br />
                                    Smartphone users and developers are forced to use the{" "}
                                    <a
                                        rel={"noopener noreferrer"}
                                        title="BBC: Apple 'like The Godfather' with new App Store rules"
                                        href="https://www.bbc.com/news/technology-68517246"
                                    >
                                        provided app stores
                                    </a>{" "}
                                    that take big cuts for basically doing nothing. The platforms
                                    are locked down and most apps wont work without some proprietary{" "}
                                    <a
                                        href="https://mobilsicher.de/ratgeber/geheime-kommandozentrale-google-play-dienste"
                                        title="mobilsicher.de: Geheime Kommandozentrale: Google Play-Dienste"
                                    >
                                        privacy invasive API’s [DE]
                                    </a>
                                    .
                                    <br />
                                    <br /> To use a simple well integrated ecosystem you are forced
                                    to pay incredible prices to stay locked in this walled garden
                                    with no perspective of leaving.
                                    <br />
                                    <br /> Services and your already payed for products can vanish
                                    at any time like they have done{" "}
                                    <a
                                        rel={"noopener noreferrer"}
                                        title={
                                            "The Verge: PlayStation Store removes purchased movies from libraries after service shutdown"
                                        }
                                        href="https://www.theverge.com/2022/7/8/23199861/playstation-store-film-tv-show-removed-austria-germany-studiocanal"
                                    >
                                        many times in the past
                                    </a>
                                    . Companies can shutdown your accounts and online presence at
                                    any time regardless of your compliance with local laws but just
                                    because your <i>legal</i> content does not fit their businesses
                                    model.
                                    <br />
                                    <br /> The move from one time payments to{" "}
                                    <a
                                        title={
                                            "Jumpstart: Do We Really Own Anything in the Subscription Economy?"
                                        }
                                        rel={"noopener noreferrer"}
                                        href="https://www.jumpstartmag.com/do-we-really-own-anything-in-the-subscription-economy/"
                                    >
                                        subscription models
                                    </a>{" "}
                                    is also great for companies as{" "}
                                    <a
                                        rel={"noopener noreferrer"}
                                        title="Wikipedia: You'll own nothing and be happy"
                                        href="https://en.wikipedia.org/wiki/You%27ll_own_nothing_and_be_happy"
                                    >
                                        “you'll own nothing and be happy”
                                    </a>{" "}
                                    if you keep using these services, further supporting this
                                    businesses model. <br />
                                    <br /> You don’t need a thought out chip implant that gets
                                    injected in your body when you carry around{" "}
                                    <a
                                        title="YouTube: Edward Snowden: How Your Cell Phone Spies on You
"
                                        rel={"noopener noreferrer"}
                                        href="https://www.youtube.com/watch?v=VFns39RXPrU"
                                    >
                                        your personal surveillance device
                                    </a>{" "}
                                    and upload your data into the giant data centers of your
                                    favorite tech giants. You don’t need such a device to be
                                    influenced and manipulated by the endless scrolling posts that
                                    are picked just for you, at best to maximize your time on their
                                    platforms and at worst to steer you and others towards hatred
                                    and{" "}
                                    <a
                                        rel={"noopener noreferrer"}
                                        href="https://www.amnesty.org/en/latest/news/2022/09/myanmar-facebooks-systems-promoted-violence-against-rohingya-meta-owes-reparations-new-report/"
                                    >
                                        ethnic cleansing of whole countries
                                    </a>
                                    . It will rarely be the obvious terrifying things that you think
                                    about, but the more subtle ones that you don't think about, that
                                    will get you. “The greatest trick the Devil ever pulled was
                                    convincing the world he didn't exist.” <br />
                                    <br />
                                    Right now it is difficult for some and nearly impossible for
                                    other services, to not be used, raising a growing concern for
                                    putting all the power into the hands of a few.
                                </p>
                            </div>
                        </div>
                        <div>
                            <Image
                                image={Fortnite1984Image}
                                alt="Still from the Fortnite 1984 video."
                                caption={
                                    <span>
                                        Epic games{" "}
                                        <a
                                            rel={"noopener noreferrer"}
                                            href="https://www.youtube.com/watch?v=ErwS24cBZPc"
                                        >
                                            Nineteen Eighty-Fortnite
                                        </a>{" "}
                                        video mocking Apple's ironic{" "}
                                        <a
                                            rel={"noopener noreferrer"}
                                            href="https://www.youtube.com/watch?v=ErwS24cBZPc"
                                        >
                                            1984 commercial
                                        </a>
                                    </span>
                                }
                            />
                            <Image image={CamerasImage} alt="Cameras" caption={""} />
                        </div>
                    </div>
                </div>
            </section>
        );
    };
}
