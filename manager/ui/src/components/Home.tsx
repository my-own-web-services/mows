import { PureComponent, type CSSProperties } from "react";

interface HomeProps {
    readonly className?: string;
    readonly style?: CSSProperties;
}

interface HomeState {}

export default class Home extends PureComponent<HomeProps, HomeState> {
    render = () => (
        <div style={this.props.style} className={`Home ${this.props.className ?? ``}`}>
            <h1 className={`text-3xl font-bold`}>Welcome to the MOWS Manager</h1>
        </div>
    );
}
