import React from "react";
import Magic from "../utilities/Magic";
import Config from "../utilities/Config";
import { Redirect, Link } from "react-router-dom";
import FileUtilities from "../utilities/FileUtilities";

export default class Encrypt extends React.PureComponent {
    constructor(props) {
        super(props);
        this.toggleShowPassword = this.toggleShowPassword.bind(this);
        this.handleChange = this.handleChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.scorePassword = this.scorePassword.bind(this);
        this.encrypt = this.encrypt.bind(this);

        this.state = {
            showPassword: false,
            password: "",
            retypePassword: "",
            working: false,
            error: ""
        };
    }

    toggleShowPassword() {
        this.setState({ showPassword: !this.state.showPassword });
    }

    handleChange(event) {
        this.setState({
            [event.target.name]: event.target.value
        });
    }

    handleSubmit(event) {
        event.preventDefault();
        this.encrypt(this.props.file);
    }

    scorePassword(password) {
        let lengthScore = password.length / (Config.maxPasswordLength / 2);
        lengthScore = (lengthScore > 1) ? 1 : lengthScore;
        lengthScore *= 4;
        const hasUpperCase = password.match(/[A-Z]/) ? 1 : 0;
        const hasLowerCase = password.match(/[a-z]/) ? 1 : 0;
        const hasNumbers = password.match(/[0-9]/) ? 1 : 0;
        const hasSymbols = password.match(/[~`!@#$%^&*()_\-+={[}\]\\|:;"'<,>.]/) ? 1 : 0;
        return ((lengthScore + hasUpperCase + hasLowerCase + hasNumbers + hasSymbols) / 8) * 100;
    }

    encrypt(file) {
        return Magic.setStateWithPromise(this, { working: true })
            .then(() => window.crypto.subtle.importKey(
                Config.key.type,
                new TextEncoder(Config.encoding).encode(btoa(this.state.password)),
                { name: Config.key.name },
                Config.key.extractable,
                Config.key.operations))
            .then(pbkdf2Key => {
                return Magic.setStateWithPromise(this, { password: "", retypePassword: "" })
                    .then(() => window.crypto.subtle.deriveKey(
                        {
                            name: Config.key.name,
                            salt: window.crypto.getRandomValues(new Uint8Array(Config.key.saltSize)),
                            iterations: Config.key.iterations,
                            hash: { name: Config.key.hash }
                        },
                        pbkdf2Key,
                        {
                            name: Config.algorithm.name,
                            length: Config.algorithm.keySize
                        },
                        Config.key.extractable,
                        Config.algorithm.options.encrypt
                    ));
            })
            .then(key => FileUtilities.readFile(file).then(data => window.crypto.subtle.encrypt(
                {
                    name: Config.algorithm.name,
                    iv: window.crypto.getRandomValues(new Uint8Array(Config.algorithm.ivSize)),
                    tagLength: Config.algorithm.tagLength
                },
                key,
                new TextEncoder(Config.encoding).encode(data)
            )))
            .then(encryptedFile => FileUtilities.saveStringAsFile(`${file.name}.${Config.fileExtension}`, new TextDecoder(Config.encoding).decode(encryptedFile)))
            .then(() => this.props.selectFile(null))
            .catch(error => Magic.setStateWithPromise(this, { error: error.toString() }))
            .then(() => Magic.setStateWithPromise(this, { working: false }));
    }

    render() {
        const { showPassword, working, done } = this.state;
        const passwordScore = this.scorePassword(this.state.password);
        const passwordCheck = showPassword || this.state.password === this.state.retypePassword;
        if (this.props.file) {
            if (working) {
                return <div>
                    <h4 className="mb-4">Working...</h4>
                    <div className="text-secondary mb-4">Go take a nap or something.<br />Or talk to this dude while you wait.</div>
                    <span role="img" aria-label="poop" style={{ fontSize: "2.5rem" }}>&#128585;</span>
                </div>;
            } else {
                return <form onSubmit={this.handleSubmit}>
                    {this.state.error ? <div className="alert alert-danger">{this.state.error}</div> : null}
                    <h4 className="mb-4">Choose a strong password.</h4>
                    <div className="input-group">
                        <input required autoFocus autoComplete="off" maxLength={Config.maxPasswordLength} type={showPassword ? "text" : "password"} className="form-control" placeholder="Type password" value={this.state.password} onChange={this.handleChange} name="password" />
                        <div className="input-group-append">
                            <button tabIndex="-1" className={"btn " + (showPassword ? "btn-success" : "btn-danger")} type="button" onClick={this.toggleShowPassword}>{showPassword ? "Hide" : "Show"}</button>
                        </div>
                    </div>
                    {showPassword ? null :
                        <div className="input-group mt-2">
                            <input required autoComplete="off" maxLength={Config.maxPasswordLength} type="password" className="form-control" placeholder="Retype password" value={this.state.retypePassword} onChange={this.handleChange} name="retypePassword" />
                        </div>}
                    <div className="progress mt-4 mb-4" style={{ height: "0.2rem" }}>
                        <div className={`progress-bar ${passwordScore < 33.33 ? "bg-danger" : (passwordScore < 66.67 ? "bg-warning" : "bg-success")}`} role="progressbar" style={{ width: `${passwordScore}%` }}></div>
                    </div>
                    <div>
                        <Link to="/file_select">
                            <button className="btn btn-light mr-2">Go back</button>
                        </Link>
                        <button disabled={!passwordCheck} type="submit" className={`btn ${passwordCheck ? "btn-success" : "btn-danger"}`}>{passwordCheck ? "Encrypt" : "Passwords do not match!"}</button>
                    </div>
                </form>
            }
        } else {
            return <Redirect to="/" />;
        }
    }
}