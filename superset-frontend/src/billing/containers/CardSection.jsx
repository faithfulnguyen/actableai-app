/**
* Use the CSS tab above to style your Element's container.
*/
import React from 'react';
import { CardElement } from 'react-stripe-elements';

const style = {
  base: {
    color: "#32325d",
    fontSmoothing: "antialiased",
    "::placeholder": {
      color: "#aab7c4"
    }
  },
  invalid: {
    color: "#fa755a",
    iconColor: "#fa755a"
  }
};

const CardSection = () => {
  return (
    <CardElement hidePostalCode={true} className="MyCardElement" style={style} />
  );
};

export default CardSection;
