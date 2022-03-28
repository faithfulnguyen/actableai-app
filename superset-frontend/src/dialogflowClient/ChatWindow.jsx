import React from 'react';
import { Button, TextArea } from 'semantic-ui-react';

/*
    This should be developed as separated component.
    It should be usable with other projects
*/
class ChatInput extends React.Component {
    constructor(props) {
        super(props);
        this.handleInputKeypress = this.handleInputKeypress.bind(this);
    }

    handleInputKeypress(event) {
        if (event.key === 'Enter' || event.charCode === 13){
            this.props.handleEnterMessage(event.currentTarget.value);
            event.currentTarget.value = '';
        }
    }

    handleClick(event) {
        this.props.handleButtonClick(event.currentTarget.value);
        event.currentTarget.value = '';
    }

    render() {
        return (
            <div>
                <TextArea row={3} placeholder='Type your message…' onKeyPress={this.handleInputKeypress} />
                <Button type='submit' onClick={this.handleClick}><i className='fa fa-paper-plane'></i></Button>
            </div>
        );
    }
}

export { ChatInput }
