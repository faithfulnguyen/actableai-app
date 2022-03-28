import {getCategoricalSchemeRegistry} from "@superset-ui/color";
import d3 from "d3";
import _ from "lodash";

const categoricalSchemeRegistry = getCategoricalSchemeRegistry();

export function getIdColor(length: number, id: number) {
    if(id === length) { return 0; }
    if(id > length) { return id % length; }
    return id;
}

export function getMedian(array: number[]) {
    const sortArr = _.sortBy(array);
    const length = sortArr.length;
    const value = _.floor(length / 2);
    const resi = length % 2;
    let result = length;
    if (length === 0){
        result = 0;
    } else if (length === 1){
        result = sortArr[0];
    } else if (length > 1) { 
        if (resi === 0){
            result = (sortArr[value] + sortArr[value - 1]) / 2;
        }else {
            result = sortArr[value];
        }
    }
    return result;
}

export function roundUpValue(value: number) {
    const factor = value > 0 ? 1 : -1;
    value = _.ceil(value * factor);
    const slace = -1 * (value.toString().length - 1);
    return _.ceil(factor * value, slace);
}

export function roundLowValue(min: number, max: number) {
    const factor = min > 0 ? 1 : -1;
    min = _.floor(min * factor);
    max = _.floor(max * (max > 0 ? 1 : -1));
    let slace = -1 * (min.toString().length - 1);
    let slaceMax = -1 * (max.toString().length - 1);
    if (slace > slaceMax) { slace = slaceMax; }
    return _.floor(factor * min, slace);
}

export function getColorScheme(scheme: string) {
    return categoricalSchemeRegistry.getMap()?.[scheme]?.['colors'];
}

export function formatNumber(value: number, format: string) {
    if (format === null || format === undefined){
        return value;
    }else if (format === 'SMART_NUMBER'){
        let result: string;
        let numberResult = _.round(value, 3);
        if(numberResult.toString().length < 4){//check lenght integer value < 3
            result = d3.format('s')(numberResult);
        }else{
            result = getFormat(numberResult);
        }
        return result;
    }else{
        return d3.format(format)(value);
    }
}

export function getFormat(value: number){
    value = _.round(value, 0);
    const str = value.toString();
    let i = str.length;
    do{
        i--;
    }
    while (str.charAt(i) === '0')
    const format = '.' + (i < 4 ? i : 4) + 's';
    return d3.format(format)(value);
}