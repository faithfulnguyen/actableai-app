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
/* eslint-disable camelcase */
import {
  ADD_SLICE,
  ON_CHANGE,
  ON_SAVE,
  REMOVE_SLICE,
  SET_COLOR_SCHEME,
  SET_EDIT_MODE,
  SET_MAX_UNDO_HISTORY_EXCEEDED,
  SET_UNSAVED_CHANGES,
  SHOW_BUILDER_PANE,
  TOGGLE_EXPAND_SLICE,
  TOGGLE_FAVE_STAR,
  TOGGLE_PUBLISHED,
  TOGGLE_PUBLIC,
  UPDATE_CSS,
  SET_REFRESH_FREQUENCY,
  SET_DIRECT_PATH,
  SET_FOCUSED_FILTER_FIELD,
} from '../actions/dashboardState';
import { BUILDER_PANE_TYPE } from '../util/constants';

export default function dashboardStateReducer(state = {}, action) {
  const actionHandlers = {
    [UPDATE_CSS]() {
      return { ...state, css: action.css };
    },
    [ADD_SLICE]() {
      const updatedSliceIds = new Set(state.sliceIds);
      updatedSliceIds.add(action.slice.slice_id);
      return {
        ...state,
        sliceIds: Array.from(updatedSliceIds),
      };
    },
    [REMOVE_SLICE]() {
      const sliceId = action.sliceId;
      const updatedSliceIds = new Set(state.sliceIds);
      updatedSliceIds.delete(sliceId);

      return {
        ...state,
        sliceIds: Array.from(updatedSliceIds),
      };
    },
    [TOGGLE_FAVE_STAR]() {
      return { ...state, isStarred: action.isStarred };
    },
    [TOGGLE_PUBLISHED]() {
      return { ...state, isPublished: action.isPublished };
    },
    [TOGGLE_PUBLIC]() {
      return { ...state, isPublic: action.isPublic };
    },
    [SET_EDIT_MODE]() {
      return {
        ...state,
        editMode: action.editMode,
        builderPaneType: action.editMode
          ? BUILDER_PANE_TYPE.ADD_COMPONENTS
          : BUILDER_PANE_TYPE.NONE,
      };
    },
    [SET_MAX_UNDO_HISTORY_EXCEEDED]() {
      const { maxUndoHistoryExceeded = true } = action.payload;
      return { ...state, maxUndoHistoryExceeded };
    },
    [SHOW_BUILDER_PANE]() {
      return { ...state, builderPaneType: action.builderPaneType };
    },
    [SET_COLOR_SCHEME]() {
      return {
        ...state,
        colorScheme: action.colorScheme,
        updatedColorScheme: true,
      };
    },
    [TOGGLE_EXPAND_SLICE]() {
      const updatedExpandedSlices = { ...state.expandedSlices };
      const sliceId = action.sliceId;
      if (updatedExpandedSlices[sliceId]) {
        delete updatedExpandedSlices[sliceId];
      } else {
        updatedExpandedSlices[sliceId] = true;
      }
      return { ...state, expandedSlices: updatedExpandedSlices };
    },
    [ON_CHANGE]() {
      return { ...state, hasUnsavedChanges: true };
    },
    [ON_SAVE]() {
      return {
        ...state,
        hasUnsavedChanges: false,
        maxUndoHistoryExceeded: false,
        editMode: false,
        builderPaneType: BUILDER_PANE_TYPE.NONE,
        updatedColorScheme: false,
      };
    },
    [SET_UNSAVED_CHANGES]() {
      const { hasUnsavedChanges } = action.payload;
      return { ...state, hasUnsavedChanges };
    },
    [SET_REFRESH_FREQUENCY]() {
      return {
        ...state,
        refreshFrequency: action.refreshFrequency,
        hasUnsavedChanges: action.isPersistent,
      };
    },
    [SET_DIRECT_PATH]() {
      return {
        ...state,
        directPathToChild: action.path,
        directPathLastUpdated: Date.now(),
      };
    },
    [SET_FOCUSED_FILTER_FIELD]() {
      const { focusedFilterField } = state;
      if (action.chartId && action.column) {
        focusedFilterField.push({
          chartId: action.chartId,
          column: action.column,
        });
      } else {
        focusedFilterField.shift();
      }
      return {
        ...state,
        focusedFilterField,
      };
    },
  };

  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
}
