import React from 'react';
import { Label, Button, Input } from 'semantic-ui-react'

function MsgReceive(props) {
    const { msg, handleButtonClick, uid } = props;
    let text;
    let buttons;

    if (msg.buttons && msg.buttons.length > 0) {
        buttons = (
            <div className='incoming'>
                {
                    msg.buttons.map((btn, index) => {
                        return (
                            <Button key={`${uid}chat-btn${index}`} onClick={handleButtonClick} basic color='blue' value={btn.payload}>{btn.title}</Button>
                        )
                    })
                }
            </div>
        );
    }

    if (msg.text !== '') {
        text = <div className='bubble lower'>
            {msg.text}
        </div>;
    }

    return (
        <div className='incoming'>
            {text}
            {buttons}
        </div>
    );
}

function MsgSend(props) {
    const { msg } = props;
    return (
        <div className='outgoing'>
            <div className='bubble'>
                {msg.text}
            </div>
        </div>
    );
}

export {
    MsgReceive,
    MsgSend,
}
