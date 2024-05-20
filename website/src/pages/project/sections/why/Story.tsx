import { Component } from "preact";
import Collapsible from "../../../../components/Collapsible";
import HashNavLink from "../../../../components/HashNavLink";
import Image from "../../../../components/Image";
//@ts-ignore
import Fortnite1984Image from "./assets/fortnite.png?w=500&format=webp&as=metadata";
import { CSSProperties } from "react";

interface StoryProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly id?: string;
}

interface StoryState {}

export default class Story extends Component<StoryProps, StoryState> {
    render = () => {
        const ul = "list-disc list-inside";
        const subUl = "list-disc list-inside ml-8";

        return (
            <section id={this.props.id}>
                <HashNavLink className={this.props.id}>
                    <h1>The Story</h1>
                </HashNavLink>
                <h3 className={"hl1 -mt-4"}>How MOWS was Born</h3>

                <div id="WhyStoryPrivacySovereignty" className={"intersect mt-8"}>
                    <HashNavLink className={"WhyStoryPrivacySovereignty"}>
                        <h2>Privacy and Sovereignty</h2>
                    </HashNavLink>
                    <div className={"mt-1"}>
                        <h3>Problem</h3>
                        <p className={"w-full md:w-2/3"}>
                            The current IT landscape is in pieces. Big Tech has thoroughly
                            vanquished their users' privacy, sovereignty and choices.
                        </p>
                        <div className={"flex flex-col md:flex-row md:items-start mt-4 md:gap-12"}>
                            <p className={"w-full md:w-2/3 "}>
                                Smartphone users and developers are forced to use the{" "}
                                <a
                                    rel={"noopener noreferrer"}
                                    title="BBC: Apple 'like The Godfather' with new App Store rules"
                                    href="https://www.bbc.com/news/technology-68517246"
                                >
                                    provided app stores
                                </a>{" "}
                                that take big cuts for basically doing nothing. The platforms are
                                locked down and most apps wont work without some proprietary{" "}
                                <a
                                    href="https://mobilsicher.de/ratgeber/geheime-kommandozentrale-google-play-dienste"
                                    title="mobilsicher.de: Geheime Kommandozentrale: Google Play-Dienste"
                                >
                                    privacy invasive APIs [DE]
                                </a>
                                .
                                <br />
                                <br /> To use a simple well integrated ecosystem, you are forced to
                                pay incredible prices to stay locked in this walled garden with no
                                prospects of leaving. Services and your paid-for products can vanish
                                at any time, like they have done{" "}
                                <a
                                    rel={"noopener noreferrer"}
                                    title={
                                        "The Verge: PlayStation Store removes purchased movies from libraries after service shutdown"
                                    }
                                    href="https://www.theverge.com/2022/7/8/23199861/playstation-store-film-tv-show-removed-austria-germany-studiocanal"
                                >
                                    many times in the past
                                </a>
                                . Companies can shut down your accounts and online presence at
                                will&mdash;regardless of your compliance with relevant laws&mdash;
                                just because your content does not fit their businesses model.
                                <br />
                                <br /> The move from one-time payments to{" "}
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
                                if you keep using these services, further supporting this businesses
                                model. <br />
                                <br />
                            </p>
                            <div className={"w-full md:h-[200px]  md:w-1/3"}>
                                <Image
                                    image={Fortnite1984Image}
                                    alt="Still from the Fortnite 1984 video."
                                    caption={
                                        <span>
                                            Epic Games{" "}
                                            <a
                                                rel={"noopener noreferrer"}
                                                href="https://www.youtube.com/watch?v=ErwS24cBZPc"
                                            >
                                                Nineteen Eighty-Fortnite
                                            </a>{" "}
                                            video mocking Apple's now ironic{" "}
                                            <a
                                                rel={"noopener noreferrer"}
                                                href="https://www.youtube.com/watch?v=ErwS24cBZPc"
                                            >
                                                1984 commercial
                                            </a>
                                        </span>
                                    }
                                />
                            </div>
                        </div>

                        <div
                            className={
                                "flex gap-12 flex-col-reverse md:flex-row md:items-center md:mt-16"
                            }
                        >
                            <p className={"w-full md:w-2/3 "}>
                                You don’t need a imaginary chip implanted in your body when you
                                carry around{" "}
                                <a
                                    title="YouTube: Edward Snowden: How Your Cell Phone Spies on You
"
                                    rel={"noopener noreferrer"}
                                    href="https://www.youtube.com/watch?v=VFns39RXPrU"
                                >
                                    your personal surveillance device
                                </a>{" "}
                                and upload your data into the massive data centers of your favorite
                                tech giants. You don’t need such a device to be influenced and
                                manipulated by the endless scrolling posts that are picked just for
                                you, at best to maximize your time on their platforms and at worst
                                to steer you and others towards hatred and{" "}
                                <a
                                    rel={"noopener noreferrer"}
                                    href="https://www.amnesty.org/en/latest/news/2022/09/myanmar-facebooks-systems-promoted-violence-against-rohingya-meta-owes-reparations-new-report/"
                                >
                                    ethnic cleansing of whole countries
                                </a>
                                .
                                <br />
                                <br />
                                Right now it is difficult and sometimes nearly impossible to avoid
                                some of the most popular services, raising a growing concern for
                                putting all the power into the hands of a few.
                            </p>
                            <div className={"w-full md:w-1/3"}>
                                <img
                                    src="/assets/story/manipulation.webp"
                                    width={1024}
                                    height={1024}
                                    alt="People looking at their smartphones with a giant red cyber eye above that is controlling them."
                                />
                            </div>
                        </div>

                        <div className={"mt-8 md:w-1/2"}>
                            <h3>Solution</h3>
                            <p>
                                Move off the cloud and take back the control of your data and the
                                freedom to do with it whatever you want! Easy right? In theory yes,
                                but this raises a whole other pile of problems to be solved. From
                                these problems the idea for MOWS was born.
                            </p>
                        </div>
                    </div>
                </div>

                <div id="WhyStorySimplicity" className={"intersect mt-24"}>
                    <HashNavLink className={"WhyStorySimplicity"}>
                        <h2>Simplicity</h2>
                    </HashNavLink>
                    <div className={"flex gap-12 flex-col md:flex-row"}>
                        <div className={"md:w-1/2"}>
                            <h3>Problem</h3>
                            <p>
                                Managing data securely and reliably on one device is difficult
                                enough as drive failures, ransomware and no or bad backup practice
                                can lead to its loss at any time. Managing data across all your, and
                                possibly the devices of employees or friends and family gets
                                exponentially more difficult.
                                <br />
                                <br />
                                Installing, configuring and using often incompatible software across
                                multiple devices with different operating systems is another great
                                challenge you will encounter when trying to get off the cloud.
                                <br /> <br />
                                Self hosting your web apps is a great option but requires a big
                                chunk of knowledge to set up even with the use of tools like docker
                                and docker-compose.
                                <br /> <br />
                                For a more reliable system you would need to get started with
                                Kubernetes on bare metal yourself, also known as difficulty level:
                                “Nightmare!”
                                <br /> <br />
                                For developers it is very time consuming to create good web apps
                                without using, mostly payed, proprietary, privacy invasive non local
                                API’s because they need to create basic features from scratch every
                                time. Things like authentication, data storage, good image display
                                with image conversion in the backend, well done video streaming,
                                offline capabilities and many more are not trivial to implement.
                                Many would like to incorporate cool technologies like realtime
                                communication, AI, End to end encryption and many more, only to find
                                out that they would need to learn a whole suite of other
                                technologies in depth to setup these technologies before they can
                                create the business logic of their application.
                                <br />
                                <br />
                                When creating everything from scratch like this another problem
                                arises: Everything gets incompatible and cluttered, videos get
                                converted twice into the same formats, files cannot be synchronously
                                used between multiple applications and so on.
                            </p>
                            <br />
                            <h3>Solution</h3>
                            <h4>(Web) APIs</h4>
                            <p>
                                At this point, it should be pointed out that the main focus is to
                                use web applications to get over the platform incompatibility of
                                native apps as well as to fight off the huge, memory hogging,
                                insecure web browsers disguised as native applications that then
                                store the files on your not synced and not backed up drive anyway.
                                Another great thing about the web platform is the incredible
                                ecosystem and rich technologies it brings with it, as well as the
                                flat learning curve to building simple applications.
                                <br />
                                <br />
                                MOWS provides all the APIs you need for the simple creation of great
                                web apps. The most important APIs are the Authentication API to
                                handle user management and authentication and the File API, that
                                handles everything related to user facing file storage: access
                                management, conversion of formats, display, sorting, finding,
                                tagging, sharing and much more. Your data all in one place ready to
                                be used by any application you want. <br />
                                <br />
                                For the established frameworks there will be integrated components
                                available to further increase the ease of use of the APIs. For
                                example components for files that automatically handle browser
                                offline storage, display of images in multiple formats and
                                resolutions, video players that can play different qualities out of
                                the box, infinite scrolling lists, search and much more. The
                                packaging and publishing of apps will also get a streamlined
                                workflow you can build on.
                                <br />
                                <br /> This will lead to easy to create applications and your files
                                being stored in one place, editable from any device that runs a web
                                browser.
                            </p>
                            <br />
                            <h4>Package Manager</h4>
                            <p>
                                The package manager will handle the lifecycle of your applications
                                as well as configuring things like:
                            </p>
                            <ul className={ul}>
                                <li>DNS</li>
                                <li>Reverse proxy settings</li>
                                <li>Access to compute resources</li>
                                <li>Access to MOWS APIs</li>
                                <li>
                                    Network settings (separate for ingress/egress) like:
                                    <ul className={subUl}>
                                        <li>disabled (default)</li>
                                        <li>local network</li>
                                        <li>public ip</li>
                                        <li>through VPN</li>
                                        <li>through TOR</li>
                                    </ul>
                                </li>
                                <li>
                                    App deployment through:
                                    <ul className={subUl}>
                                        <li>A static web server for SPAs</li>
                                        <li>Containers</li>
                                        <li>Multi container deployments</li>
                                        <li>VMs</li>
                                    </ul>
                                </li>
                            </ul>
                            <br />
                            <h4>Backup</h4>
                            <p>
                                Automated, encrypted, append only(if applicable) backups on machines
                                at one (better two) collocations are regularly performed. The setup
                                of the collocation machines is easily done with the installer.
                            </p>
                        </div>
                        <div></div>
                    </div>
                </div>

                <div id="WhyStoryReliability" className={"intersect mt-24"}>
                    <HashNavLink className={"WhyStoryReliability"}>
                        <h2>Reliability</h2>
                    </HashNavLink>
                    <div className={"flex gap-12 flex-col md:flex-row"}>
                        <div className={"md:w-1/2"}>
                            <h3>Problem</h3>
                            <p>
                                Providers of cloud applications have high standards of reliability
                                that can’t be matched by a simple one machine setup at home. This is
                                no problem if you are running a home server for fun, but intolerable
                                when the intention is to use this device as your primary workhorse
                                for everything from your home automation, mail server, your business
                                applications or public websites.
                            </p>
                            <br />
                            <h3>Solution</h3>
                            <p>
                                Using multiple independent physical machines that use MOWS to
                                combine them into one more powerful reliable "machine". At least
                                three machines are required to achieve this automated (more) fail
                                safe system. This may sound overkill, but not only can the
                                individual machines be relatively cheap, the setup and replacement
                                can be performed mostly automatically. The problem for a home setup
                                may not be the small downtime when upgrading the RAM or a broken
                                power supply but more about the times you can’t or don’t want to fix
                                problems like these. Even in a home setup it would be very bad if
                                all your services failed when you just started your vacation and
                                relied on things like mail, password sync or files from your server.
                                <br />
                                When managing your own hardware is not your thing and you would
                                rather pay a few dollars per month you can rent a physical or
                                virtual server online, from any provider, that then runs the
                                distributed MOWS system. If you change your mind it will be easy to
                                switch to another provider or to your own hardware.
                            </p>
                        </div>
                        <div></div>
                    </div>
                </div>
                <div id="WhyStoryOpennessCompatibility" className={"intersect mt-24"}>
                    <HashNavLink className={"WhyStoryOpennessCompatibility"}>
                        <h2>Openness and Compatibility</h2>
                    </HashNavLink>
                    <div className={"flex gap-12 flex-col md:flex-row"}>
                        <div className={"md:w-1/2"}>
                            <h3>Problem</h3>
                            <p>
                                When building web apps yourself on the APIs of any proprietary cloud
                                platform you will be left tightly locked into their ecosystem and
                                paying them a premium for it. Even migrating or downloading your
                                data has been made difficult to keep you locked in.
                                <br />
                                <br />
                                Software developed for any non free (as in freedom) operating system
                                or ecosystem is a giant waste of time as anything related to it can
                                disappear forever without any chance of recovering.
                            </p>
                            <br />
                            <h3>Solution</h3>
                            <p>
                                MOWS and its APIs are free and open source as well as the underlying
                                technologies. In the end MOWS is an overlay for kubernetes,
                                containers and their related technologies so you aren’t even relying
                                on the MOWS package manger to stay around as you could always
                                migrate to a plain standardized container environment.
                                <br />
                                <br />
                                Software not made for MOWS can be used without problems and be
                                automatically set up to run in single and multi container
                                deployments as well as in virtual machines that could also host a
                                proprietary OS that is then used as a gaming/desktop streaming
                                setup. In this case the use of the MOWS APIs is of course limited as
                                the software would need to support them. Some of them are easy to
                                integrate as they are standardized, like Zitadel with OAuth 2.0.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        );
    };
}
