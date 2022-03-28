import * as _ from "lodash";

export function detectIntWithNanColumns(datasource: IDatasource){
    let int_with_nan_columns = [];
    let float_cols = datasource.columns.filter((c) => c.type !== null && (c.type === "DOUBLE PRECISION"))
    for (let i = 0; i < float_cols.length; i++) {
      let col_values = datasource.group_values[float_cols[i].column_name]?.map((v) => v.value) || [];
      let int_values = col_values.map(function (x) {
        return parseInt(x);
      });
      let float_values = col_values.map(function (x) {
        return parseFloat(x);
      });
      if (_.isEmpty(_.xor(int_values, float_values))){
        float_cols[i].type = "BIGINT";
        int_with_nan_columns.push(float_cols[i]);
      };
    };
    return int_with_nan_columns;
}

export function getColumnDataType(datasource: IDatasource, columnName: string) {
  return datasource.columns.filter((column) => column.column_name === columnName)[0]?.type;
}

export const numericTypes: IDatasourceColumnType[] = ['BIGINT', 'DOUBLE PRECISION'];
export const categoricalTypes: IDatasourceColumnType[] = ['VARCHAR', 'STRING', 'CHAR', 'BOOLEAN'];

export function getMutauallyExculusiveOptions(state: IState,
                                              fieldName: string,
                                              mutuallyExclusiveMultiDropdowns: string[],
                                              mutuallyExclusiveDropdowns: string[],
                                              whitelistTypes: IDatasourceColumnType[],
                                              blacklistTypes: IDatasourceColumnType[]) {
  const alreadySelectedOptions: string[] = []
  mutuallyExclusiveMultiDropdowns.filter(name=>name!==fieldName).forEach((option) => alreadySelectedOptions.push(...(state.controls?.[option]?.value || [])))
  mutuallyExclusiveDropdowns.filter(name=>name!==fieldName).forEach((option) => alreadySelectedOptions.push(state.controls?.[option]?.value))

  return (state.datasource?.columns || []).filter((x) => {
    if(whitelistTypes && !whitelistTypes.includes(x.type)) {
      return false;
    }
    if (blacklistTypes && blacklistTypes.includes(x.type)) {
      return false;
    }
    return !alreadySelectedOptions.includes(x.column_name);
  });
}

export const getOptionsFromValue = (state: IState, fieldName: string) => (state.datasource?.columns || [])
  .filter((column) => state?.controls?.[fieldName]?.value?.includes(column.column_name))
