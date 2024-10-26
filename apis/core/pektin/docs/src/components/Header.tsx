import React, { Component, Fragment } from "react";

const links = [
    { id: "gitlab", urlPrefix: "https://git.y.gy/pektin/", text: "git.y.gy", icon: "" },
    { id: "gitlabcom", urlPrefix: "https://gitlab.com/pektin/", text: "GitLab", icon: "" },
    { id: "github", urlPrefix: "https://github.com/pektin-dns/", text: "GitHub", icon: "" },
    { id: "dockerhub", urlPrefix: "https://hub.docker.com/r/pektin/", text: "Docker Hub", icon: "" }
];

interface HeaderProps {
    name: string;
}
interface HeaderState {}

export class Header extends Component<HeaderProps, HeaderState> {
    render = () => {
        const selectedLinks = links.filter(
            link => !(this.props.useDocker === false && link.id === "dockerhub")
        );
        return (
            <div className="headerLinkBar">
                {selectedLinks.flatMap((link, i: number) => {
                    return [
                        <Fragment>
                            <a
                                key={link.text}
                                rel="noreferrer"
                                href={link.urlPrefix + this.props.name}
                            >
                                {link.text}
                            </a>
                            {i !== selectedLinks.length - 1 ? " | " : ""}
                        </Fragment>
                    ];
                })}
            </div>
        );
    };
}
