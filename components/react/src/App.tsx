import { type CSSProperties, PureComponent } from "react";

interface AppProps {
    readonly className?: string;
    readonly style?: CSSProperties;
}

interface AppState {}

export default class App extends PureComponent<AppProps, AppState> {
    constructor(props: AppProps) {
        super(props);
        this.state = {};
    }

    render = () => {
        return (
            <div
                style={{ ...this.props.style }}
                className={`App h-full w-full overflow-x-hidden ${this.props.className ?? ``}`}
            >
                <div className={`p-6 text-foreground`}>
                    <h1 className={`text-xl font-semibold`}>MOWS React Components</h1>
                    <p className={`text-sm text-muted-foreground`}>
                        Component playground / dev shell.
                    </p>
                </div>
            </div>
        );
    };
}
