import { Component } from "preact";

interface AppProps {}
interface AppState {}
export default class App extends Component<AppProps, AppState> {
    render = () => {
        return (
            <div className="App">
                <nav></nav>
                <main>
                    <div className="hero">
                        <h1>
                            Leave the dark <br /> clouds behind
                        </h1>
                        <h2>Start taking back control of your data today!</h2>
                    </div>

                    <div>
                        <p>
                            This project is NOT production ready. You can help us to get it there by
                            donating your work or money.
                        </p>
                    </div>

                    <div className="features">
                        <div>
                            <h1>Users</h1>
                            <ul>
                                <li>
                                    <h2>All in one</h2>
                                    <p>
                                        Sync your passwords, share your images, watch your movies
                                        and much more all in one simple package.
                                    </p>
                                </li>
                                <li>
                                    <h2>Privacy & Security</h2>
                                    <p>
                                        Through your own server you have full control over your
                                        data. With the power of open source you can be sure that it
                                        stays this way.
                                    </p>
                                </li>

                                <li>
                                    <h2>Freedom</h2>
                                    <p>
                                        Public file cloud providers can terminate their service or
                                        lock you out at any time.
                                    </p>
                                </li>
                            </ul>
                        </div>
                        <div>
                            <h1>Admins</h1>
                            <ul>
                                <li>
                                    <h2>Easy to setup and maintain</h2>
                                    <p>
                                        With our simple configuration and update system you can get
                                        a server up and running in no time.
                                    </p>
                                </li>
                                <li>
                                    <h2>Efficient and Fast</h2>
                                    <p>
                                        With the power of Rust our services only consume minimal
                                        resources when idle and can handle a lot of load when they
                                        need to.
                                    </p>
                                </li>
                                <li>
                                    <h2>Easy to adapt</h2>
                                    <p>
                                        The same tools we use to create a highly configurable
                                        application without compromises can be used for your
                                        adaption use case too.
                                    </p>
                                </li>
                            </ul>
                        </div>
                        <div>
                            <h1>Developers</h1>
                            <ul>
                                <li>
                                    <h2>A platform to build on</h2>
                                    <p>
                                        As cool as some other cloud projects are, they are mostly
                                        not made to build or expand on. We want to bring first class
                                        support for building your own apps on top of our cloud.
                                    </p>
                                </li>
                                <li>
                                    <h2>Modern Tech Stack</h2>
                                    <p>
                                        With the use of Containers, Rust, TypeScript and Preact we
                                        are making use of technologies that are fun to work with.
                                    </p>
                                </li>
                            </ul>
                        </div>
                    </div>
                </main>
            </div>
        );
    };
}
