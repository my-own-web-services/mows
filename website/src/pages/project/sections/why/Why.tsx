import { Component } from "preact";
import HashNavLink from "../../../../components/HashNavLink";

import WhyProblems from "./WhyProblems";
import WhyDifferent from "./WhyDifferent";

interface WhyProps {}
interface WhyState {}
export default class Why extends Component<WhyProps, WhyState> {
    render = () => {
        return (
            <section className={"Why"} id="Why">
                <section className={"subsection"}>
                    <HashNavLink className={"Why"}>
                        <h1 className={"centerAligned"}>Why</h1>
                    </HashNavLink>

                    <div className={"childrenSideBySide"}>
                        <div>
                            <h2 className={"hl1"}>self-host?</h2>

                            <p className={"largeText"}>
                                Since the internet and smartphone revolution it has been difficult
                                to keep your digital sovereignty as capabilities but also complexity
                                grew. The digital world is more centralized than ever and in the
                                hands of only a few companies that want you tightly locked into
                                their closed ecosystems. Competition has been made nearly
                                impossible, prices can be raised at any time and privacy is a thing
                                of the past.
                            </p>
                        </div>
                        <div>
                            <h2 className={"hl1"}>choose MOWS?</h2>
                            <p className={"largeText"}>
                                MOWS is not just another Home-Server. MOWS OS is not limited to just
                                one machine but can use many to make it highly reliable and
                                scalable. MOWS does not leave you standing in the rain on day two as
                                it brings integrated solutions for backups, public static IPs and
                                much more. The MOWS APIs make it easy to create great apps.
                            </p>
                        </div>
                    </div>
                </section>

                <WhyProblems />

                <WhyDifferent />
            </section>
        );
    };
}
