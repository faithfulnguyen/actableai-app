/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React from 'react';
import PropTypes from 'prop-types';
import { SupersetClient } from '@superset-ui/connection';
import DataTable from "react-data-table-component";
import { DropdownButton, MenuItem } from 'react-bootstrap';
import ReactPaginate from "react-paginate";
import { Modal, Alert, Form, Row, FormGroup, FormControl, FormLabel } from 'react-bootstrap';
import getClientErrorObject from '../utils/getClientErrorObject';
import $ from 'jquery';
import DescriptionModal from 'src/components/Modal/DescriptionModal';
import AuthWrapper from 'src/components/AuthWrapper';

const propTypes = {
  onConfirm: PropTypes.func,
};

export default class DataContainer extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      data: {},
      selectedCount: 0,
      keyword: "",
      order_column: "",
      order_direction: "",
      modalConfirm: false,
      linkDelete: "",
      id: [],
      ids: [],
      multiple: false,
      pageIndex: 0,
      pageSize: 25,
      modalClone: false,
      linkClone: '',
      cloneName: '',
      cloneId: 0,
      nameError: false,
      cloneLoading: false,
      selectedItemIndex: null,
      selectedAction: null,
    };

    this.setState = this.setState.bind(this);
    this.searchData = this.searchData.bind(this);
    this.changePageSize = this.changePageSize.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleClose = this.handleClose.bind(this);
  }

  async componentDidMount() {
    const queryParams = {
      page: this.state.pageIndex,
      page_size: this.state.pageSize,
    };
    const data = await SupersetClient.get({
      endpoint: `${this.props.api}?q=${JSON.stringify(queryParams)}`
    });
    this.setState({
      data: data.json,
    });
  }

  async searchData(e, order, sort) {
    const keyword = e ? e.target.value : this.state.keyword;
    const order_column = order ? order : this.state.order_column;
    const order_direction = sort ? sort : this.state.order_direction;
    // 
    const queryParams = {
      page: this.state.pageIndex,
      page_size: this.state.pageSize,
      keyword: keyword,
    };
    if (order_column !== "") { queryParams.order_column = order_column; }
    if (order_direction !== "") { queryParams.order_direction = order_direction; }
    const data = await SupersetClient.get({
      endpoint: `${this.props.api}?q=${JSON.stringify(queryParams)}`
    });
    this.setState({
      data: data.json,
      selectedCount: 0,
      keyword,
      order_column,
      order_direction,
    });
  }

  onSelectedRowsChange = (rows) => {
    let ids = rows.selectedRows.map(x => x.id);
    this.setState({
      selectedCount: rows.selectedCount,
      ids
    })
  }

  onSort = (column, sort) => {
    this.searchData(null, column.order_column, sort);
  }

  async changePageSize(value) {
    await this.setState({
      pageSize: value,
      pageIndex: 0,
    });
    this.searchData(null, null, null);
  }

  onPageChange = async ({ selected }) => {
    await this.setState({
      pageIndex: selected,
    });
    this.searchData(null, null, null);
  };

  onDeleteRow() {
    SupersetClient.delete({
      endpoint: `${this.state.linkDelete}?q=[${this.state.id.length > 0 ? this.state.id : this.state.ids}]`,
    }).then(
      ({ json }) => {
        this.searchData(null, null, null);
        this.showMessage("info", json?.message)
      }
    ).catch(response =>
      getClientErrorObject(response)
        .then((parsedResp) => {
          if (parsedResp && parsedResp.message) {
            this.showMessage("danger", parsedResp.message)
          }
        })
    );
    this.handleClose();
  }

  onClone(linkClone, id) {
    this.setState({
      modalClone: true,
      linkClone: linkClone,
      cloneId: id
    })
  }

  onConfirm(linkDelete, id) {
    this.setState({
      modalConfirm: true,
      linkDelete,
      id: id ? [id] : []
    });
  }

  handleKeyDown(e) {
    if (e.key === 'Enter') {
      this.searchData(e, null, null);
    }
  }

  handleClose() {
    this.setState({
      modalConfirm: false,
    });
  }

  handleCloneClose() {
    this.setState({
      modalClone: false
    })
  }

  showMessage = (type, message) => {
    const template =
      '<div class="alert"> ' +
      '<button type="button" class="close" ' +
      'data-dismiss="alert">\xD7</button> </div>';
    const alertType = type || 'info';
    $('#alert-container').html("");
    $(template)
      .addClass('alert-' + alertType)
      .append(message)
      .appendTo($('#alert-container'));

  }

  onCloneData = () => {
    if (this.state.cloneName) {
      this.setState({
        cloneLoading: true
      })
      SupersetClient.post({
        endpoint: `${this.state.linkClone}`,
        postPayload: {
          name: this.state.cloneName,
          id: this.state.cloneId
        },
        stringify: false
      }).then(
        ({ json }) => {
          this.searchData(null, null, null);
          this.showMessage("info", json?.message)
        }
      ).catch(response => {
        getClientErrorObject(response)
          .then((parsedResp) => {
            if (parsedResp && parsedResp.message) {
              this.showMessage("danger", parsedResp.message)
            }
          });
        
      } 
      ).finally(() => {
        this.setState({
          cloneLoading: false
        });
        this.handleCloneClose();
      });
    }
    else {
      this.setState({
        nameError: true
      })
    }

  }

  onDownload = (linkDownload, id, typeDownload) => {
    if(typeDownload == 'CHART') {
      SupersetClient.get({
        endpoint: `/api/v1/chart/check-result/${id}`,
      }).then(
        ({ json }) => {
          console.log(json);
          if(json?.result) {
            this.handleDownload(`${linkDownload}/${id}`)
          }
          else {
            this.showMessage("danger", "Please run analytic at first")
          }
        }
      ).catch(response =>
        getClientErrorObject(response)
          .then((parsedResp) => {
            if (parsedResp && parsedResp.message) {
              this.showMessage("danger", parsedResp.message)
            }
          })

      );
    }
    else {
      this.handleDownload(`${linkDownload}/${id}`)
    }
    
  }

  handleChange = (e) => this.setState({ cloneName: e.target.value })

  handleDownload = (linkDownload) => {
    const link = document.createElement('a');
    link.href = linkDownload;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  renderButton(linkEdit, linkDelete, linkClone, linkDownload, id, can_edit, can_delete, typeDownload) {
    return (
      <AuthWrapper className="btn-action-group">
        {can_edit && (
          <a href={linkEdit + id}>
            <svg width="16" height="17" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M14.6051 5.71765L14.1382 4.90758C13.7433 4.22214 12.8681 3.98568 12.1817 4.37898C11.855 4.57145 11.4651 4.62605 11.0981 4.53075C10.7311 4.43545 10.417 4.19808 10.2252 3.87097C10.1018 3.66305 10.0355 3.42623 10.033 3.18447C10.0441 2.79686 9.89787 2.42124 9.62758 2.14319C9.35729 1.86514 8.98596 1.70834 8.59819 1.7085H7.65769C7.27779 1.70849 6.91355 1.85987 6.64556 2.12915C6.37758 2.39842 6.22794 2.76338 6.22977 3.14328C6.21851 3.92763 5.57942 4.55755 4.79499 4.55747C4.55322 4.55496 4.3164 4.48865 4.10849 4.36525C3.42211 3.97195 2.5469 4.20841 2.15197 4.89385L1.65082 5.71765C1.25637 6.40223 1.48961 7.27689 2.17256 7.67417C2.61649 7.93047 2.88996 8.40413 2.88996 8.91673C2.88996 9.42934 2.61649 9.903 2.17256 10.1593C1.49048 10.5539 1.25698 11.4264 1.65082 12.109L2.12451 12.9259C2.30955 13.2598 2.62001 13.5062 2.98721 13.6105C3.3544 13.7149 3.74804 13.6686 4.08103 13.482C4.40837 13.2909 4.79845 13.2386 5.16457 13.3366C5.53068 13.4346 5.84249 13.6747 6.03068 14.0037C6.15408 14.2116 6.22039 14.4484 6.2229 14.6902C6.2229 15.4826 6.86528 16.125 7.65769 16.125H8.59819C9.38792 16.125 10.0292 15.4868 10.033 14.6971C10.0311 14.316 10.1817 13.95 10.4512 13.6805C10.7207 13.411 11.0867 13.2604 11.4678 13.2623C11.7089 13.2687 11.9448 13.3348 12.1543 13.4545C12.8388 13.8489 13.7135 13.6157 14.1108 12.9328L14.6051 12.109C14.7964 11.7806 14.8489 11.3894 14.751 11.0222C14.653 10.655 14.4127 10.342 14.0833 10.1524C13.7539 9.96291 13.5136 9.64987 13.4157 9.28265C13.3177 8.91542 13.3703 8.5243 13.5616 8.19591C13.686 7.97869 13.8661 7.79859 14.0833 7.67417C14.7622 7.27711 14.9949 6.40756 14.6051 5.72451V5.71765Z" stroke="#081721" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <ellipse cx="8.13141" cy="8.91669" rx="1.97712" ry="1.97712" stroke="#081721" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        )}
        {can_delete && (
          <a onClick={() => this.onConfirm(linkDelete, id)}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12.75 4.5H16.5V6H15V15.75C15 15.9489 14.921 16.1397 14.7803 16.2803C14.6397 16.421 14.4489 16.5 14.25 16.5H3.75C3.55109 16.5 3.36032 16.421 3.21967 16.2803C3.07902 16.1397 3 15.9489 3 15.75V6H1.5V4.5H5.25V2.25C5.25 2.05109 5.32902 1.86032 5.46967 1.71967C5.61032 1.57902 5.80109 1.5 6 1.5H12C12.1989 1.5 12.3897 1.57902 12.5303 1.71967C12.671 1.86032 12.75 2.05109 12.75 2.25V4.5ZM13.5 6H4.5V15H13.5V6ZM6.75 8.25H8.25V12.75H6.75V8.25ZM9.75 8.25H11.25V12.75H9.75V8.25ZM6.75 3V4.5H11.25V3H6.75Z" fill="black" />
            </svg>
          </a>
        )}
        {!can_delete && !can_edit && linkClone && (
          <a onClick={() => this.onClone(linkClone, id)}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M13.3337 0.833008H3.33366C2.41699 0.833008 1.66699 1.58301 1.66699 2.49967V14.1663H3.33366V2.49967H13.3337V0.833008ZM15.8337 4.16634H6.66699C5.75033 4.16634 5.00033 4.91634 5.00033 5.83301V17.4997C5.00033 18.4163 5.75033 19.1663 6.66699 19.1663H15.8337C16.7503 19.1663 17.5003 18.4163 17.5003 17.4997V5.83301C17.5003 4.91634 16.7503 4.16634 15.8337 4.16634ZM15.8337 17.4997H6.66699V5.83301H15.8337V17.4997Z" fill="black"/>
            </svg>
          </a>
        )}
        {!can_delete && !can_edit && linkDownload && (
          <a onClick={() => this.onDownload(linkDownload, id, typeDownload)}>
            <svg width="18" height="18" viewBox="0 0 22 25" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 15C20.7348 15 20.4804 15.1054 20.2929 15.2929C20.1054 15.4804 20 15.7348 20 16V20.213C19.9992 20.9519 19.7053 21.6603 19.1828 22.1828C18.6603 22.7053 17.9519 22.9992 17.213 23H4.787C4.04809 22.9992 3.33966 22.7053 2.81717 22.1828C2.29468 21.6603 2.00079 20.9519 2 20.213V16C2 15.7348 1.89464 15.4804 1.70711 15.2929C1.51957 15.1054 1.26522 15 1 15C0.734784 15 0.48043 15.1054 0.292893 15.2929C0.105357 15.4804 0 15.7348 0 16V20.213C0.00132359 21.4822 0.506092 22.699 1.40354 23.5965C2.30099 24.4939 3.51782 24.9987 4.787 25H17.213C18.4822 24.9987 19.699 24.4939 20.5965 23.5965C21.4939 22.699 21.9987 21.4822 22 20.213V16C22 15.7348 21.8946 15.4804 21.7071 15.2929C21.5196 15.1054 21.2652 15 21 15Z" fill="black"/>
              <path d="M16.2809 9.29297L11.9879 13.586L11.9879 0.999969C11.9879 0.734753 11.8825 0.480398 11.695 0.292862C11.5074 0.105326 11.2531 -3.05176e-05 10.9879 -3.05176e-05C10.7227 -3.05176e-05 10.4683 0.105326 10.2808 0.292862C10.0932 0.480398 9.98787 0.734753 9.98787 0.999969L9.98787 13.586L5.69487 9.29297C5.50627 9.11081 5.25367 9.01002 4.99147 9.0123C4.72927 9.01457 4.47846 9.11974 4.29305 9.30515C4.10765 9.49056 4.00248 9.74137 4.0002 10.0036C3.99792 10.2658 4.09871 10.5184 4.28087 10.707L10.2809 16.707C10.4684 16.8944 10.7227 16.9998 10.9879 16.9998C11.253 16.9998 11.5073 16.8944 11.6949 16.707L17.6949 10.707C17.877 10.5184 17.9778 10.2658 17.9755 10.0036C17.9733 9.74137 17.8681 9.49056 17.6827 9.30515C17.4973 9.11974 17.2465 9.01457 16.9843 9.0123C16.7221 9.01002 16.4695 9.11081 16.2809 9.29297V9.29297Z" fill="black"/>
            </svg>
          </a>
        )}
      </AuthWrapper>
    );
  }

  render() {
    let header = [...this.props.header];
    let action = {
      id: this.props.actions.id,
      name: "Actions",
      width: "90px",
      cell: (row) => this.renderButton(this.props.actions.linkEdit, this.props.actions.linkDelete, this.props.actions.linkClone, this.props.actions.linkDownload, row.id, row.can_edit, row.can_delete, this.props.actions.typeDownload)
    }
    header.push(action);
    return (
      <>
        <Modal show={this.state.modalConfirm} onHide={this.handleClose} className="modal-delete">
          <Modal.Header closeButton>
            <Modal.Title>User confirmation needed</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {this.state.id.length > 0 ? 'Are you sure you want to delete this item?' : 'Delete all Really?'}
          </Modal.Body>
          <Modal.Footer>
            <button type="button" onClick={() => this.handleClose()} className="btn btn-default">Cancel</button>
            <button type="button" onClick={() => this.onDeleteRow()} className="btn btn-danger danger">OK</button>
          </Modal.Footer>
        </Modal>
        <Modal show={this.state.modalClone} onHide={this.handleCloneClose} className="modal-clone">
          <Modal.Header closeButton>
            <Modal.Title>Clone data</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <FormGroup >
              <FormControl pattern="[a-zA-Z0-9_]+" required type="text" placeholder="name" onChange={this.handleChange} />
              {this.state.nameError ? <span style={{ color: "red" }}>Please enter valid name</span> : ''}
              
            </FormGroup>
          </Modal.Body>
          <Modal.Footer>
            <button type="button" onClick={() => this.handleCloneClose()} className="btn btn-default" disabled={this.state.cloneLoading}>Cancel</button>
            <button type="button" onClick={() => this.onCloneData()} className="btn btn-danger danger" disabled={this.state.cloneLoading}>
            {this.state.cloneLoading 
              ? <img style={{width:"12px"}} src='/static/assets/images/loading-white.gif' />
              : 'OK'}
            </button>
          </Modal.Footer>
        </Modal>
        <div className="tabulatedTableSearchFlex">
          <div className="spacer"/>
          <div className="record-count-and-search">
            <div className="group-record-count">
              <strong className="label-record-count">Record Count: </strong>
              <span className="record-count">{this.state.data.count}</span>
            </div>
            <div className="list-search-container">
              <svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M24.8717 23.767L18.9717 17.867C20.3895 16.1649 21.0965 13.9817 20.9456 11.7716C20.7948 9.56151 19.7977 7.49465 18.1617 6.001C16.5258 4.50734 14.377 3.7019 12.1623 3.75222C9.9476 3.80255 7.83759 4.70476 6.27117 6.27117C4.70476 7.83759 3.80255 9.9476 3.75222 12.1623C3.7019 14.377 4.50734 16.5258 6.001 18.1617C7.49465 19.7977 9.56151 20.7948 11.7716 20.9456C13.9817 21.0965 16.1649 20.3895 17.867 18.9717L23.767 24.8717L24.8717 23.767ZM5.34044 12.3717C5.34044 10.981 5.75281 9.62162 6.52542 8.46533C7.29802 7.30905 8.39615 6.40784 9.68094 5.87566C10.9657 5.34348 12.3795 5.20424 13.7434 5.47554C15.1073 5.74684 16.3602 6.4165 17.3435 7.39984C18.3269 8.38318 18.9965 9.63603 19.2678 11C19.5391 12.3639 19.3999 13.7776 18.8677 15.0624C18.3355 16.3472 17.4343 17.4454 16.278 18.218C15.1218 18.9906 13.7623 19.4029 12.3717 19.4029C10.5075 19.4009 8.72029 18.6594 7.40213 17.3412C6.08396 16.0231 5.34251 14.2359 5.34044 12.3717Z" fill="#808080"></path>
              </svg>
              <input
                className="form-control"
                onBlur={this.searchData}
                onKeyDown={this.handleKeyDown}
                placeholder={this.props.placeholder}
                />
            </div>
          </div>
        </div>
        {
          this.state.data.result != undefined && <DataTable
            columns={header}
            data={this.state.data.result.map((item, index) => {
              item.onDescriptionClick = () => {
                this.setState({
                  selectedAction: 'description',
                  selectedItemIndex: index,
                })
              };
              return item;
            })}
            defaultSortFieldId={1}
            selectableRows
            onSelectedRowsChange={this.onSelectedRowsChange}
            onSort={this.onSort}
          />
        }
        {
          this.state.data.count != undefined && this.state.data.count > 0 && <div className="paging-group text-center">
            <AuthWrapper>
              <DropdownButton id="btn-actions" title="Actions" disabled={this.state.selectedCount == 0 ? true : false}>
                <MenuItem onClick={() => this.onConfirm(this.props.actions.linkDelete, null)}>Delete</MenuItem>
              </DropdownButton>
            </AuthWrapper>
            <ReactPaginate
              pageCount={Math.ceil(this.state.data.count / this.state.pageSize)}
              pageRangeDisplayed={4}
              marginPagesDisplayed={1}
              onPageChange={this.onPageChange}
              containerClassName="pagination"
              activeClassName="active"
              pageLinkClassName="page-link"
              breakLinkClassName="page-link"
              nextLinkClassName="page-link"
              previousLinkClassName="page-link"
              pageClassName="page-item"
              breakClassName="page-item"
              nextClassName="page-item"
              previousClassName="page-item"
              previousLabel={
                <svg width="8" height="13" viewBox="0 0 8 13" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6.556 12L1 6.5L6.556 1" stroke="#808385" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
              nextLabel={
                <svg width="8" height="13" viewBox="0 0 8 13" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 12L6.556 6.5L1 1" stroke="#808385" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
            />
            <DropdownButton id="btn-page-size" title="Page size">
              {
                [25, 50, 75, 100].map((value) =>
                  <MenuItem
                    className={value == this.state.pageSize ? "active" : ""}
                    key={`page-size-${value}`}
                    onClick={() => this.changePageSize(value)}
                  >
                    {value}
                  </MenuItem>
                )
              }
            </DropdownButton>
          </div>
        }
        {this.state.selectedAction === 'description' && this.state.selectedItemIndex !== null && (
          <DescriptionModal
            data={{...this.state.data.result[this.state.selectedItemIndex], dataType: this.props.dataType }}
            onHide={() => this.setState({ selectedAction: null })}
            onSuccess={(response) => {
              const nextDataResult = [...this.state.data.result];
              const itemToUpdate = nextDataResult[this.state.selectedItemIndex];
              itemToUpdate.description = response.description;
              this.setState({ data: { ...this.state.data, result: nextDataResult }});
            }}
          />
        )}
      </>
    );
  }
}

DataContainer.propTypes = propTypes;
