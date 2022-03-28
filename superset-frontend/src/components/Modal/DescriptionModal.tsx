import Axios from 'axios';
import React, { useEffect, useState } from 'react'
import AceEditor from 'react-ace';
import { Button, Modal } from 'react-bootstrap'
import { getCSRFToken } from '../../utils/api';
import styled from 'styled-components';
import MarkdownPreview from '../MarkdownPreview'

const EditorContainer = styled.div`
  height: 500px;
  padding-left: 20px;
`; 

type Props = {
  data: {
    id: number;
    description: string;
    can_edit: boolean;
    dataType: 'dataset' | 'chart';
  };
  onHide: () => void;
  onSuccess: (result: any) => void;
}

function DescriptionModal({ data, onHide, onSuccess }: Props) {
  const [value, setValue] = useState(data?.description || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setValue(data?.description || '')
  }, [data?.description || ''])

  const onClickEditOrSave = async () => {
    if (!isEditing) {
      setIsEditing(true);
      return;
    }
    try {
      setIsLoading(true);
      const csrfToken = await getCSRFToken()
      const response = (await Axios.put(`/api/v1/${data.dataType}/${data.id}`, {
        description: value,
      }, { 
        headers: { 'X-CSRF-TOKEN': csrfToken }
      })).data;
      if (response.result) {
        onSuccess(response.result);
      }
      setIsEditing(false);
      setIsLoading(false);
    } catch (e) {

    }
    setIsLoading(false);
  }

  return (
    <Modal show onHide={onHide} style={{width: 'min(max-content, 600px)'}}>
      <Modal.Header>
        <Modal.Title>
          Description
        </Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ minHeight: 0, overflowY: 'auto', padding: isEditing ? 0 : undefined }}>
        {(isEditing && (
          <EditorContainer>
            <AceEditor
              mode="markdown"
              theme="textmate"
              width="100%"
              height="100%"
              showGutter={false}
              editorProps={{ $blockScrolling: true }}
              value={value}
              onChange={(nextValue) => setValue(nextValue)}
              wrapEnabled
              focus
            />
          </EditorContainer>
        )) || <MarkdownPreview source={value || '## No Description'} />}
      </Modal.Body>
      <Modal.Footer>
        {data.can_edit && (
          <Button bsStyle='primary' onClick={onClickEditOrSave} disabled={isLoading}>
            {isEditing ? 'Save' : 'Edit'}
          </Button>
        )}
        <Button bsStyle='warning' onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

export default DescriptionModal
