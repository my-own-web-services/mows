import React, { Component } from "react";

interface NamecheapProps {}
interface NamecheapState {
    readonly domainName: string;
}
export default class Namecheap extends Component<NamecheapProps, NamecheapState> {
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
                        href={`https://ap.www.namecheap.com/domains/domaincontrolpanel/${this.state.domainName}/domain`}
                        rel="noreferrer"
                    >
                        https://ap.www.namecheap.com/domains/domaincontrolpanel/
                        {this.state.domainName}/domain
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
                <div>
                    <picture>
                        <source
                            srcset={
                                require("@site/static/img/registrars/namecheap/ns.webp").default
                            }
                            type="image/webp"
                        />
                        <source
                            srcset={require("@site/static/img/registrars/namecheap/ns.png").default}
                            type="image/png"
                        />

                        <img
                            alt="Single glue record"
                            style={{ width: "800px", height: "auto" }}
                            src={require("@site/static/img/registrars/namecheap/ns.png").default}
                        />
                    </picture>
                </div>
                <br />
                <h2>Set Glue records</h2>
                <div>
                    Your glue records should correspond to your set nameservers and are only needed
                    for your main/nameserver domain.
                </div>
                <b>
                    <a
                        target="_blank"
                        href={`https://ap.www.namecheap.com/Domains/DomainControlPanel/${this.state.domainName}/advancedns`}
                        rel="noreferrer"
                    >
                        https://ap.www.namecheap.com/Domains/DomainControlPanel/
                        {this.state.domainName}/advancedns
                    </a>
                </b>
                <br />
                <br />
                <div>
                    At most registrars you can enter multiple IPs per glue record seperated by line
                    breaks. Namecheap does at time of writing <b>NOT</b> support IPv6 in their UI
                    (You have to contact support...). <br /> We don't even understand ourselfs how
                    setting glue records really works with them. So... Good luck have fun (
                    <a
                        href="https://www.namecheap.com/support/knowledgebase/article.aspx/768/10/how-do-i-register-personal-nameservers-for-my-domain/"
                        rel="noreferrer"
                    >
                        This is their guide
                    </a>
                    )
                    <br />
                    If your server has an IPv6 address <b>you should add it too</b>. In fact IPv6
                    should be your <b>first choice</b> as <b>IPv4 is deprecated.</b>
                </div>
                <br />
                <div>
                    <picture>
                        <source
                            srcset={
                                require("@site/static/img/registrars/namecheap/namecheap-glue.webp")
                                    .default
                            }
                            type="image/webp"
                        />
                        <source
                            srcset={
                                require("@site/static/img/registrars/namecheap/namecheap-glue.png")
                                    .default
                            }
                            type="image/png"
                        />
                        <img
                            style={{ width: "800px", height: "auto" }}
                            alt="List of glue records"
                            src={
                                require("@site/static/img/registrars/namecheap/namecheap-glue.png")
                                    .default
                            }
                        />
                    </picture>
                </div>
                <br />
                <br />
            </div>
        );
    };
}
