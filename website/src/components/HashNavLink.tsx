import { Component } from "preact";
import React, { Children } from "react";

interface HashNavLinkProps {
    readonly children?: any;
    readonly className?: string;
}
interface HashNavLinkState {}
export default class HashNavLink extends Component<HashNavLinkProps, HashNavLinkState> {
    render = () => {
        return (
            <div className={`HashNavLink`}>
                <a
                    style={{ textDecoration: "none", color: "var(--c-text)", cursor: "pointer" }}
                    href={`#${this.props.className}`}
                    id={this.props.className}
                >
                    {this.props.children}
                </a>
            </div>
        );
    };
}
