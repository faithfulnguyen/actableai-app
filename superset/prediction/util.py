import pandas as pd
import re
import json
import visions

def makeCorrectName(s):
    return s.replace(' ', '_')


def returnDataTable(df):
    exdata = json.loads(df.to_json(orient="table"))
    for item in exdata["data"]:
        if "index" in item:
            del item["index"]
    exdata["schema"]["fields"].pop(0)
    return exdata

def isCategory(column):
    if column in visions.Float:
        return False
    if column in visions.Integer:
        (dc,) = column.value_counts().shape
        if dc <=5:
            return True
        else:
            return False
    return True

def findFredForGluon(freq):
    # For W:
    if re.findall("\d*W", freq):
        return re.findall("\d*W", freq)[0]
    elif re.findall("\d*M", freq):
        return re.findall("\d*M", freq)[0]

    return freq

def findFred(pd_date): ## Need to sorted before.
    freq = pd.infer_freq(pd_date)
    if freq:
        return freq
    infer_list = {}
    data_len = len(pd_date)
    if data_len < 3:
        # print("None")
        return None
    for i in range(0, data_len - 3, 3):
        fred = pd.infer_freq(pd_date[i: i + 3])
        if fred not in infer_list:
            infer_list[str(fred)] = 0
        infer_list[str(fred)] += 1
    infer_list = sorted(infer_list, key=lambda fred: infer_list[fred], 
                        reverse=True)
    return infer_list[0]

    

def make_future_dataframe(periods, pd_date,freq, include_history=True):
    history_dates = pd.to_datetime(pd_date).sort_values()
    """Simulate the trend using the extrapolated generative model.
    Parameters
    ----------
    periods: Int number of periods to forecast forward.
    freq: Any valid frequency for pd.date_range, such as 'D' or 'M'.
    include_history: Boolean to include the historical dates in the data
        frame for predictions.
    Returns
    -------
    pd.Dataframe that extends forward from the end of self.history for the
    requested number of periods.
    """

    if history_dates is None:
        raise Exception('Model must be fit before this can be used.')
    last_date = history_dates.max()
    dates = pd.date_range(
        start=last_date,
        periods=periods + 1,  # An extra in case we include start
        freq=freq)
    dates = dates[dates > last_date]  # Drop start if equals last_date
    dates = dates[:periods]  # Return correct number of periods

    if include_history:
        dates = np.concatenate((np.array(history_dates), dates))

    return pd.DataFrame({'ds': dates})
