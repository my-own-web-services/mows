import React, { Component } from "react";

interface GandiProps {}
interface GandiState {
    readonly domainName: string;
}
export default class Gandi extends Component<GandiProps, GandiState> {
    state = {
        domainName: "example.com"
    };
    render = () => {
        return (
            <div>
                <label htmlFor="domainName">
                    {" "}
                    <h3>Enter your domain name for direct links</h3>
                </label>
                <input
                    type="text"
                    value={this.state.domainName}
                    onChange={e => this.setState({ domainName: e.target.value })}
                    name="domainName"
                    placeholder="example.com"
                    style={{ padding: "5px", fontSize: "18px" }}
                />
                <br />
                <br />
                <h2>Edit your Nameservers</h2>
                <b>
                    <a
                        target="_blank"
                        href={`https://admin.gandi.net/domain/${this.state.domainName}/nameservers/edit`}
                        rel="noreferrer"
                    >
                        https://admin.gandi.net/domain/{this.state.domainName}/nameservers/edit
                    </a>
                </b>
                <br />
                <br />
                {this.props.children}
                <b>For Example</b> (You can be creative here even if nearly nobody will see it)
                <div>ns1.{this.state.domainName}</div>
                <div>ns2.{this.state.domainName}</div>
                <div>ns3.{this.state.domainName}</div>
                <br />
                <h2>Set Glue records</h2>
                <div>
                    Your glue records should correspond to your set nameservers and are only needed
                    for your main/nameserver domain.
                </div>
                <b>
                    <a
                        target="_blank"
                        href={`https://admin.gandi.net/domain/${this.state.domainName}/gluerecords`}
                        rel="noreferrer"
                    >
                        https://admin.gandi.net/domain/{this.state.domainName}/gluerecords
                    </a>
                </b>
                <br />
                <br />
                <div>
                    <picture>
                        <source
                            srcset={
                                require("@site/static/img/registrars/gandi/gandi-glue.webp").default
                            }
                            type="image/webp"
                        />
                        <source
                            srcset={
                                require("@site/static/img/registrars/gandi/gandi-glue.png").default
                            }
                            type="image/png"
                        />
                        <img
                            style={{ width: "500px", height: "auto" }}
                            alt="List of glue records"
                            src={
                                require("@site/static/img/registrars/gandi/gandi-glue.png").default
                            }
                        />
                    </picture>
                </div>
                <br />
                <div>
                    At most registrars you can enter multiple IPs per glue record seperated by line
                    breaks. If your server has an IPv6 address <b>you should add it too</b>. In fact
                    IPv6 should be your <b>first choice</b> as <b>IPv4 is deprecated.</b>
                </div>
                <br />
                <div>
                    <picture>
                        <source
                            srcset={
                                require("@site/static/img/registrars/gandi/gandi-glue-2.webp")
                                    .default
                            }
                            type="image/webp"
                        />
                        <source
                            srcset={
                                require("@site/static/img/registrars/gandi/gandi-glue-2.png")
                                    .default
                            }
                            type="image/png"
                        />

                        <img
                            alt="Single glue record"
                            style={{ width: "800px", height: "auto" }}
                            src={
                                require("@site/static/img/registrars/gandi/gandi-glue-2.png")
                                    .default
                            }
                        />
                    </picture>
                </div>
            </div>
        );
    };
}
