import pandas as pd

def get_satisfied_formats(row, unique_formats):
    satisfied_formats = []  
    for format in unique_formats:
        try:
            pd.to_datetime(row, format=format)
            satisfied_formats.append(format)
        except:
            continue
    
    return satisfied_formats

def parse_datetime(dt_str, formats):
    for fm in formats:
        try:
            result = pd.to_datetime(dt_str, format=fm)
            return result
        except Exception:
            pass
    return None

def parse_by_format_with_valid_frequency(series, formats):
    for fm in formats:
        try:
            result = pd.to_datetime(series.astype(str), format=fm)
            if pd.infer_freq(result):
                return result
        except Exception:
            pass
    return pd.to_datetime(series, format=formats[0])