import React from 'react';
import { ChatInput } from './ChatWindow'
import { SupersetClient } from '@superset-ui/connection';
import { MsgReceive, MsgSend } from './Message';
import ScrollToBottom from 'react-scroll-to-bottom';
/*
    This should be developed as separated component. 
    It should be usable with other projects
*/
const propTypes = {};
export default class DialogFlowClientContainer extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = {
            messages: [],
            msgelems: [],
        };
        this.handleEnterMessage = this.handleEnterMessage.bind(this);
    }

    postNewMessage(result) {
        this.setState((state) => {
            state.messages.push({
                sender: 2,
                text: result.json.message,
                buttons: result.buttons || [],
            });
            return state;
        }, () => this.bindingMessage())
    }

    sendMessage(input) {
        let message = {
            message: input
        };
        SupersetClient.post({
            endpoint: '/api/dialogflow',
            postPayload: message,
            stringify: false,
        }).then(
            (result) => {
                this.postNewMessage(result);
            }
        ).catch(() => false);
    }

    handleEnterMessage(input) {
        if (input.length < 1) {
            return
        }
        this.setState((state) => {
            state.messages.push({
                sender: 1,
                text: input,
            });
            return state;
        }, () => this.bindingMessage());
        this.sendMessage(input);
    }

    bindingMessage() {
        let { messages } = this.state;
        let messElem = [];
        {
            messages.map(function (value, i) {
                if (value) {
                    if (value.sender === 1) {
                        messElem.push(<MsgSend key={i} uid={`msg${i}`} msg={value} />);
                    } else {
                        messElem.push(<MsgReceive key={i} uid={`msg${i}`} msg={value} />);
                    }
                }
            })
        }
        this.setState({
            msgelems: messElem
        })
    }

    handleButtonClick(event) {
        this.handleEnterMessage(event.target.value);
    }

    render() {
        let { msgelems, visible } = this.state;
        const { app_name: appName } = this.props.bootstrapData;
        let style = {};
        if (this.props.hide) {
            style.display = 'none';
        }
        return (
            <div>
                <div className='chatbox' style={style}>
                    <div className='top-bar'>
                        <div className='name'>{appName} (alpha)</div>
                    </div>
                    <div className='middle'>
                        <ScrollToBottom className='chatti-content'>{msgelems}</ScrollToBottom>
                    </div>
                    <div className='bottom-bar'>
                        <ChatInput handleEnterMessage={this.handleEnterMessage}></ChatInput>
                    </div>
                </div>
            </div>
        );
    }
}

DialogFlowClientContainer.propTypes = propTypes;
