import React from 'react';
import PropTypes from 'prop-types';

const propTypes = {
  onChange: PropTypes.func,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

const defaultProps = {
  onChange: () => {},
};

let name = 'fa fa-angle-down';

export default function MoreOption(props) {
  function moreOption(){
    const data = props.option;
    const hidden = (document.getElementById('more-option').classList).contains('fa-angle-up');
    // hidden/show controls
    for(let i=0; i<data.length; i++){
    	const item = document.getElementById(data[i]).classList;
    	if(hidden){
			item.add("hidden");
		}else{
			item.remove("hidden");
		}
    }
    // class icon
    if(hidden){
    	name = "fa fa-angle-down";
    }else{
    	name = "fa fa-angle-up";
    }
  }

  // This wouldn't be necessary but might as well
  return (
    <div style={{height:28}}>
        <span 
          style={{color:'#198ace',cursor:'pointer'}}
          onClick={moreOption}
        >
          More option
          <i id="more-option" className={name}></i>
        </span>
      </div>
  );
}

MoreOption.propTypes = propTypes;
MoreOption.defaultProps = defaultProps;