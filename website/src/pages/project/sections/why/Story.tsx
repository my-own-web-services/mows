import { Component } from "preact";
import Collapsible from "../../../../components/Collapsible";
import HashNavLink from "../../../../components/HashNavLink";
import Image from "../../../../components/Image";
//@ts-ignore
import Fortnite1984Image from "./assets/fortnite.png?w=500&format=webp&as=metadata";
import { CSSProperties } from "react";
import Figure from "../../../../components/Figure";

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

                <div id="WhyStorySovereignty" className={"intersect mt-8"}>
                    <HashNavLink className={"WhyStorySovereignty"}>
                        <h2>Sovereignty</h2>
                    </HashNavLink>
                    <div>
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
                                is also great for companies as “you'll own nothing and be happy” if
                                you keep using these services, further supporting this businesses
                                model. <br />
                                <br />
                                {/*TODO: Messengers and network effects */}
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
                    </div>
                </div>

                <div id="WhyStoryPrivacy" className={"intersect mt-8"}>
                    <HashNavLink className={"WhyStoryPrivacy"}>
                        <h2>Privacy</h2>
                    </HashNavLink>
                    <p className={"largeText"}>
                        This part is pretty grim and may sound like fear mongering to some, but it
                        is important to not underestimate the risks we are facing with the current
                        state of the internet. If you are already convinced that privacy is
                        important, you can skip this part.
                    </p>
                    <div className={"mt-8"}>
                        <h3>I have nothing to hide</h3>
                        <p>
                            That was what I thought before I got into the tech sector and saw what
                            is possible with the data being collected. When I started to learn more
                            about privacy, I realized that it isn't about hiding; it's about
                            protecting our rights, dignity, and lives from misuse of our personal
                            information. In a world where data is constantly collected, privacy
                            safeguards our freedom and security. This does not mean that you have to
                            hide everything, but that you should have a real choice to do so.
                        </p>
                        <p className={"mt-4"}>
                            Even when you have the privilege to trust your current government, you
                            should always be aware that this can change in an instant and that the
                            data collected today can be used against you in the future. Only one
                            example is the Third Reich, where gay people were persecuted and killed
                            based on the so-called{" "}
                            <a
                                rel={"noopener noreferrer"}
                                href="https://media.ccc.de/v/36c3-101-rosa-listen"
                            >
                                Rosa Listen(Pink Lists)[DE]
                            </a>{" "}
                            from the Weimar Republic that before were "only" used to track them.
                            There are many more examples of how data can be used against you, even
                            if you are not doing anything wrong.
                        </p>
                    </div>
                    <div
                        className={
                            "flex gap-12 flex-col-reverse md:flex-row md:items-start md:mt-16"
                        }
                    >
                        <div className={"w-full md:w-2/3 "}>
                            <h3>Manipulation</h3>

                            <p>
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
                                you, at best to maximize your time on their platforms, getting you
                                addicted, and at worst to steer you and others towards hatred and
                                violence. It has been shown that this, even by negligence, can lead
                                to{" "}
                                <a
                                    rel={"noopener noreferrer"}
                                    href="https://www.amnesty.org/en/latest/news/2022/09/myanmar-facebooks-systems-promoted-violence-against-rohingya-meta-owes-reparations-new-report/"
                                >
                                    the ethnic cleansing of whole countries
                                </a>
                                .
                            </p>
                        </div>
                        <div className={"w-full md:w-1/3"}>
                            <img
                                src="/assets/story/manipulation.webp"
                                loading={"lazy"}
                                width={1024}
                                height={1024}
                                alt="People looking at their smartphones with a giant red cyber eye above that is controlling them."
                            />
                        </div>
                    </div>
                    <div>
                        <h3>Weapons of War, Threats to Democracy</h3>
                        <p>
                            About one hundred years ago, Nazi Germany used the latest technology of
                            their time to manipulate the masses with broadly targeted propaganda
                            campaigns. Today TV and Radio seem laughable as a medium for
                            manipulation compared to the highly personalized feeds that can be
                            created with the data collected by tech giants and governments today.
                        </p>
                        <br />
                        <p>
                            In democracies this data can be used to manipulate public opinion as
                            well as elections, as has been
                            <a
                                rel={"noopener noreferrer"}
                                href="https://en.wikipedia.org/wiki/Facebook%E2%80%93Cambridge_Analytica_data_scandal"
                            >
                                {" "}
                                shown
                            </a>{" "}
                            in the past. In authoritarian regimes it can be used to suppress
                            opposition and to track down people.
                        </p>
                        <br />
                        <div
                            className={
                                "flex justify-between flex-col md:flex-row md:items-start md:gap-12"
                            }
                        >
                            <p className={"w-full md:w-2/3"}>
                                The manipulation of the masses is not only a threat to democracy
                                internally, but also to the peace between nations. When talking
                                about the domains of war it has long been established that
                                information warfare is a crucial part of it, whether it is to spread
                                propaganda or misinformation to an enemy population or to manipulate
                                soldiers or leaders themselves.
                            </p>
                            <Figure
                                className={"w-full md:w-1/3 md:-mt-40"}
                                caption={
                                    <>
                                        The domains of warfare as intersecting layers <br />
                                        <a
                                            rel={"noopener noreferrer"}
                                            href="https://www.youtube.com/watch?v=xnQIYdBkoV0"
                                        >
                                            More about information warfare [DE]
                                        </a>
                                    </>
                                }
                            >
                                {" "}
                                <img
                                    width={110}
                                    height={80.229347}
                                    className={"w-full"}
                                    src="/assets/diagrams/domains_of_warfare.svg"
                                    alt="A diagram showing the domains of war"
                                />
                            </Figure>
                        </div>
                    </div>
                </div>

                <div id="WhyStorySimplicity" className={"intersect mt-24"}>
                    <HashNavLink className={"WhyStorySimplicity"}>
                        <h2>Simplicity</h2>
                    </HashNavLink>
                    <div className={"flex flex-col md:flex-row md:items-start mt-4 md:gap-12"}>
                        <div className={"w-full md:w-1/2"}>
                            <HashNavLink className={"WhyStorySimplicityForUsers"}>
                                <h3>For users</h3>
                            </HashNavLink>

                            <p className={"pb-4"}>
                                Managing data securely and reliably on one device is difficult
                                enough as drive failures, ransomware and no or bad backup practice
                                can lead to its loss at any time. Managing data across all your, and
                                possibly the devices of employees or friends and family gets
                                exponentially more difficult.{" "}
                            </p>
                            <p className={"pb-4"}>
                                Installing, configuring and using often incompatible software across
                                multiple devices with different operating systems is another great
                                mess you will encounter when trying to get off the cloud.
                            </p>
                            <p className={"pb-4"}>
                                Self hosting your web apps is a great option but requires a big
                                chunk of knowledge to set up even with the use of tools like docker
                                and docker-compose.
                            </p>
                            <p className={"pb-4"}>
                                For a more reliable system you would need to get started with
                                Kubernetes on bare metal yourself, also known as difficulty level:
                                “Nightmare!”
                            </p>
                        </div>
                        <div className={"w-full md:w-1/2"}>
                            <Figure
                                caption={
                                    <>
                                        Poor Moby is totally confused by the complexity of the
                                        Kubernetes setup
                                    </>
                                }
                            >
                                <img
                                    src="/assets/story/moby_confused.webp"
                                    alt="A diagram showing the traditional cloud setup"
                                    width={1024}
                                    height={1024}
                                />
                            </Figure>
                        </div>
                    </div>

                    <HashNavLink className={"WhyStorySimplicityForDevelopers"}>
                        <h3>For Developers</h3>
                    </HashNavLink>

                    <div className={"flex flex-col md:flex-row md:items-center mt-4 md:gap-12"}>
                        <div className={"md:w-2/5"}>
                            <HashNavLink className={"WhyStorySimplicityForDevelopersWebApps"}>
                                <h4>Web Apps</h4>
                            </HashNavLink>

                            <p>
                                When the first iPhone was released in 2007, there was no App Store
                                and no way to install native applications. When asked about this,
                                Steve Jobs said that people should just build web apps. It didn't
                                take long, for him to realize, that the web of the time wasn't ready
                                for this and that a central app store would be extremely profitable
                                for the company too.
                                <br /> The webs' frontend has come a long way since then and is now
                                more than capable of building anything from simple websites to
                                complex applications.
                                <br />
                                There is a reason why people keep using tools like Electron to build
                                native applications, despite its many downsides. Whether you like it
                                or not, the web is the largest, most standardized and compatible
                                frontend platform for applications we have. This said, I don't think
                                that things like Electron are the answer to building apps. What? You
                                are putting your web app in a separate browser just to use the local
                                file system, to then have your files not backed up or synchronized?
                                Yes, this is kind of stupid, but there is a reason for it, the web
                                is missing a very important piece of the puzzle.
                            </p>
                        </div>
                        <div className={"w-full md:w-3/5 mx-2"}>
                            <Figure caption={<>App architecture and cloud sync concepts</>}>
                                <img
                                    src="/assets/diagrams/cloud_sync.svg"
                                    alt="A diagram showing apps and cloud sync"
                                    width={1321}
                                    height={921}
                                />
                            </Figure>
                        </div>
                    </div>

                    <br />

                    <div className={"flex flex-col md:flex-row md:items-center mt-4 md:gap-12"}>
                        <div className={"md:w-3/5"}>
                            <HashNavLink
                                className={"WhyStorySimplicityForDevelopersTheMissingPiece"}
                            >
                                <h4>The missing piece</h4>
                            </HashNavLink>
                            <p>
                                Let's take a step back and look at the web as an operating system,
                                made up of the frontend web application that is facing the user and
                                the backend that interacts with the data and hardware. The frontend
                                is well standardized, but the backend is everyone's own business.
                                Now compare this to a "real" operating system that interfaces with
                                the hardware. Imagine every application frontend on an OS would
                                interface directly with the hard drive to store its data. Every
                                application would need to reimplement a huge amount of software only
                                to save some data to disk. Even worse, either, every application
                                writes to one disk, interfering with each other or each application
                                writes to a separate disk keeping the data intact but not
                                interoperable between applications. This is why we have a file
                                system on every "real" operating system that manages the data for
                                our applications. Going back to the web as an operating system, we
                                recognize the missing piece, a backend file system that handles this
                                interaction for our applications.
                                <br /> <br />
                                This is not a new idea after all, WebDAV brought with it a
                                standardized protocol for interacting with files. So why isn't every
                                application using WebDAV instead of building its own file backend?
                                The problem is that WebDAV is just a basic file system. While that's
                                great for background 1:1 file transfers, it isn't enough to create
                                an even half useable web app because of, among other things, network
                                constraints. Not even local file systems and computers are fast
                                enough to "brute force" render 40 MB RAW images in an instant to the
                                screen. This is why developers need to create image previews,
                                convert videos, create search indexes and much more.
                                <br />
                                <br />
                                As there is no standard API for doing this, app developers need to
                                create this logic themselves time and time again instead of creating
                                their business logic. This does also lead to the same desync
                                problems as for the original files. Creating different video
                                versions for streaming is very computationally expensive and
                                time-consuming. Creating them multiple times for each app is a huge
                                waste of resources.
                            </p>
                        </div>
                        <div className={"w-full md:w-2/5 mx-2"}>
                            <Figure
                                caption={
                                    <>
                                        {" "}
                                        Traditional web app stacks, creating everything from scratch
                                    </>
                                }
                            >
                                <img
                                    src="/assets/diagrams/everything_from_scratch_1.svg"
                                    alt="A diagram showing the traditional web app stack"
                                    width={742}
                                    height={581}
                                />
                            </Figure>

                            <Figure caption={<>MOWS app, building on top of the MOWS cloud APIs</>}>
                                {" "}
                                <img
                                    src="/assets/diagrams/everything_from_scratch_2.svg"
                                    alt="A diagram showing the mows app stack"
                                    width={742}
                                    height={572}
                                />
                            </Figure>
                        </div>
                    </div>

                    <br />
                    <HashNavLink className={"WhyStorySimplicityForDevelopersCloudAPIs"}>
                        <h4>Cloud APIs</h4>
                    </HashNavLink>

                    <p>
                        The example above only highlights the missing file API. There are many other
                        areas where developers are wasting their time reimplementing the same stuff
                        over and over again. MOWS solves this problem by providing APIs over the
                        network as well as frontend components that automatically use the network
                        provided APIs. The second really important API that MOWS will provide is
                        authentication. More details can be found in the{" "}
                        <a href="/#FivePartsCloudAPIs"> Cloud APIs </a>section.
                    </p>
                </div>

                <div id="WhyStoryReliability" className={"intersect mt-24"}>
                    <HashNavLink className={"WhyStoryReliability"}>
                        <h2>Reliability</h2>
                    </HashNavLink>
                    <div className={"flex gap-12 flex-col md:flex-row"}>
                        <div className={"md:w-1/2"}>
                            <HashNavLink className={"WhyStoryReliabilityUpgradingTheLab"}>
                                <h3>Upgrading the Lab</h3>
                            </HashNavLink>

                            <p>
                                Providers of cloud applications have high standards of reliability
                                that can’t be matched by a simple one machine setup at home. This is
                                no problem if you are running a home server for fun, but intolerable
                                when the intention is to use this device as your primary workhorse
                                for everything from your home automation, mail server, your business
                                applications or public websites.
                            </p>
                            <br />

                            <p>
                                The solution to this problem is not to rely on any single part that
                                can fail and to make the things that are most likely to fail
                                redundant first. MOWS uses multiple independent physical machines to
                                achieve this goal. At least three machines are required to achieve
                                this automated (more) fail safe system. This may sound overkill, but
                                not only can the individual machines be relatively cheap, the setup
                                and replacement can be performed mostly automatically. The problem
                                for a home setup may not be the small downtime when upgrading the
                                RAM or a broken power supply but more about the times you can’t or
                                don’t want to fix problems like these. Even in a home setup it would
                                be very bad if all your services failed when you just started your
                                vacation and relied on things like mail, password sync or files from
                                your server.
                            </p>
                            <br />

                            <p>
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
                <div id="WhyStoryOpenness" className={"intersect mt-24"}>
                    <HashNavLink className={"WhyStoryOpenness"}>
                        <h2>Openness</h2>
                    </HashNavLink>
                    <div className={"flex gap-12 flex-col md:flex-row"}>
                        <div className={"w-full md:w-1/2"}>
                            <p>
                                When building web apps with the proprietary APIs of any cloud
                                provider you will soon find yourself locked in to their ecosystem.
                                Without the prospect of leaving, because your application is tightly
                                coupled with their APIs, you will be forced to either pay their ever
                                growing prices or completely recreate your application. Even
                                migrating or downloading your data has been made difficult to keep
                                you locked in.
                                <br />
                                <br />
                                Software developed for any non free (as in freedom) operating system
                                or ecosystem is a giant waste of time and money as anything related
                                to it can disappear forever without any chance of recovering. Sure,
                                open source projects can be discontinued as well, but at least you
                                have the <b>chance</b> to fork it and continue the development and
                                use.
                            </p>
                            <br />
                            <p>
                                MOWS and its APIs are free and open source as well as the underlying
                                technologies. In the end MOWS is an overlay for Kubernetes,
                                containers, QEMU VMs and their related technologies so you aren’t
                                even relying on the MOWS package manger to stay around as you could
                                always migrate to a plain container environment.
                                <br />
                                <br />
                                Software not made for MOWS can be used without problems too and be
                                automatically set up to run in single and multi container
                                deployments as well as in virtual machines. The latter can also host
                                a proprietary OS that is then used as a gaming/desktop streaming
                                setup. In this case the use of the MOWS Cloud APIs is of course
                                limited as the software would need to support or use them. Some of
                                the APIs are easy to integrate with foreign software too as they are
                                standardized, like using Zitadel with any OAuth 2.0 consumer.
                            </p>
                            <p className={"mt-4"}>
                                MOWS will not be limited to one central app store. You can run any
                                other application and still be sure that it won't be able to destroy
                                or infect your system as apps run completely isolated by default.
                            </p>
                        </div>
                        <div className={"w-full md:w-1/2"}>
                            <Figure caption={<>Building on proprietary APIs be like...</>}>
                                <img
                                    src="/assets/story/api_prison.webp"
                                    alt="A symbol image for the API lock in showing persons locked in with servers in a walled prison."
                                    width={1024}
                                    height={1024}
                                />
                            </Figure>
                        </div>
                    </div>
                </div>
            </section>
        );
    };
}
