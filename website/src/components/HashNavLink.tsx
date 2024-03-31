import { Component } from "preact";

interface HashNavLinkProps {
    readonly children?: any;
    readonly className?: string;
}
interface HashNavLinkState {}
export default class HashNavLink extends Component<HashNavLinkProps, HashNavLinkState> {
    render = () => {
        return (
            <div id={this.props.className} className={`HashNavLink ${this.props.className}`}>
                <a
                    style={{ textDecoration: "none", color: "var(--v-text)", cursor: "pointer" }}
                    href={`#${this.props.className}`}
                >
                    {this.props.children}
                </a>
            </div>
        );
    };
}
