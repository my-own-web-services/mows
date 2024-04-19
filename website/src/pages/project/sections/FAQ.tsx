import { Component } from "preact";
import { CSSProperties } from "preact/compat";
import HashNavLink from "../../../components/HashNavLink";

interface FAQItem {
    readonly question: string;
    readonly answer: string;
}

interface FAQProps {
    readonly className?: string;
    readonly style?: CSSProperties;
}

interface FAQState {}

const faq: FAQItem[] = [
    {
        question: "Nothing here yet!",
        answer: "Ask us a question and we will add it here!"
    }
];

export default class FAQ extends Component<FAQProps, FAQState> {
    constructor(props: FAQProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    render = () => {
        return (
            <section
                style={{ ...this.props.style }}
                className={`FAQ ${this.props.className ?? ""}`}
            >
                <HashNavLink className={"FAQ"}>
                    <h1>FAQ</h1>
                </HashNavLink>
                <div>
                    {faq.map(({ question, answer }) => (
                        <div key={question}>
                            <h3>{question}</h3>
                            <p>{answer}</p>
                        </div>
                    ))}
                </div>
            </section>
        );
    };
}
