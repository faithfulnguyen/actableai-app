import { Form, Formik, FormikHelpers } from 'formik'
import React from 'react'
import ModalHeader from './Header'
import Modal from './Modal'
import * as yup from 'yup';
import styled from 'styled-components';
import Logo from '../Logo';
import Spacer from '../Spacer';
import TextField from '../Input/Text';
import Divider from '../Divider';
import Button from '../Input/Button';
import Axios from 'axios';

const validationSchema = yup.object({
  username: yup.string().required(),
  password: yup.string().required()
})

const initialValues = {
  username: '',
  password: '',
}

const Content = styled.div`
  padding: 40px 50px 60px;
  width: 400px;
`;

const GridForm = styled(Form)`
  display: grid;
  grid-gap: 10px;
`;

function AuthModal(props: ReactModal.Props) {
  const onSubmit = async (values: any, helpers: FormikHelpers<any>) => {
    const formData = new FormData();
    formData.append('username', values.username);
    formData.append('password', values.password);
    formData.append('csrf_token', (window as any).csrf_token);
    try {
      await Axios.post("/login/", formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    } catch (e) {

    }
    window.location.href = window.location.href;
  }

  const onGoogle = (isRegister?: boolean) => {
    window.gtag?.('event', 'google-sign-in', { 
      event_category: 'User',
      event_label: `sign-${isRegister ? 'up' : 'in'}`
    });
    window.location.href = '/oauth/google?next='+window.location.href;
  }

  const onRegister = () => {
    window.location.href = '/register/form';
  }
  
  return (
    <Modal {...props}>
      <ModalHeader onClose={props.onRequestClose}>
        Login
      </ModalHeader>
      <Content>
        <Logo width='270px' height='90px'/>
        <Spacer height={40} />
        <Formik
          onSubmit={onSubmit}
          initialValues={initialValues}
          validationSchema={validationSchema}
        >
          <GridForm>
            <TextField label='Username' name='username' autoComplete='current-username'/>
            <TextField label='Password' name='password' autoComplete='current-password' type='password'/>
            <Button design='primary' type='submit'>Login</Button>
            <Button design='primary' onClick={() => onGoogle()}>Login with Google</Button>
            <Divider height={2} />
            <Button design='bordered' onClick={onRegister}>Register</Button>
            <Button design='bordered' onClick={() => onGoogle(true)}>Register with Google</Button>
          </GridForm>
        </Formik>
      </Content>
    </Modal>
  )
}

export default AuthModal