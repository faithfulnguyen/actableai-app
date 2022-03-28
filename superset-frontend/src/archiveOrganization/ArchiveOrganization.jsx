/* eslint-disable */
import React from 'react';
import { SupersetClient } from '@superset-ui/connection';
import Loading from 'src/components/Loading';

export default class ArchiveOrganization extends React.PureComponent{
    constructor(props) {
        super(props);
        this.state = {
            option: '6',
            password: '',
            isLoading: false,
            errors: {},
        };
        this.handleChange = this.handleChange.bind(this);
        this.deleteSandbox = this.deleteSandbox.bind(this);
    }

    handleChange(event){
        const target = event.target;
        const value = target.type === 'checkbox' ? target.checked : target.value;
        const name = target.name;
        this.setState({
            [name]: value
        })
    };

    async deleteSandbox() {
        this.setState({
            isLoading: true,
        });
        const { password, option } = this.state;
        const { json: confirmPasswordResult } = await SupersetClient.post({
            endpoint: '/archive-organization/check-password',
            stringify: false,
            postPayload: {
                password
            }
        });
        if(!confirmPasswordResult) {
            this.setState({
                isLoading: false,
                errors: {
                    password: 'Wrong password'
                }
            });
        }
    }

    render() {
        const { option, password, errors } = this.state;
        return (
            <>
                {
                    !this.state.isLoading &&
                    <div className="panel panel-primary">
                        <div className="panel-heading">
                        </div>
                        <div className="panel-body">
                            <h1 className="pb-15 border-bottom">Delete Project</h1>
                            <p className="red-text text-25">
                                You are going to delete Actable AI project. Removed project CANNOT be
                                restored! Are you ABSOLUTELY sure ?
                            </p>
                            <p className="text-25">
                                This action can lead to <span className="red-text">data loss.</span> To
                                prevent accidental actions we ask you confirm you intention.
                            </p>
                            <p className="text-25">
                                Please type <span className="red-text">your password</span> to proceed
                                or close this modal to cancel.
                            </p>
                            <div className="row">
                                <div className="col-md-6">
                                    <div className="radio">
                                        <label>
                                            <input type="radio" name="option" value="6" onChange={this.handleChange} checked={option === '6'}/>
                                            Keep for 6 months
                                        </label>
                                    </div>
                                    <div className="radio">
                                        <label>
                                            <input type="radio" name="option" value="3" onChange={this.handleChange} checked={option === '3'}/>
                                            Keep for 3 months
                                        </label>
                                    </div>
                                    <div className="radio">
                                        <label>
                                            <input type="radio" name="option" value="1" onChange={this.handleChange} checked={option === '1'}/>
                                            Keep for 1 month
                                        </label>
                                    </div>
                                    <div className="radio">
                                        <label>
                                            <input type="radio" name="option" value="delete" onChange={this.handleChange} checked={option === 'delete'}/>
                                            Delete immediate
                                        </label>
                                    </div>
                                    <input
                                        className="form-control mt-10"
                                        type="password"
                                        placeholder="Confirm password"
                                        name="password"
                                        value={this.state.password}
                                        onChange={this.handleChange}
                                    />
                                    {
                                        errors.password && <p className="red-text mt-10">{errors.password}</p>
                                    }
                                </div>
                            </div>
                            <p className="border-bottom pb-20 mb-30" />
                            <button
                                className="btn btn-custom mr-10"
                                disabled={!this.state.option || !this.state.password}
                                onClick={this.deleteSandbox}
                            >Delete</button>
                            <button className="btn btn-custom mr-10">Cancel</button>
                        </div>
                    </div>
                }
                {
                    this.state.isLoading && <Loading size={50} />
                }
            </>
        )
    }
}
