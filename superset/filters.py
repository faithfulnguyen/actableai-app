import os
from superset import db as dbs
from sqlalchemy import bindparam, text
import pandas as pd
from pandas.api.types import is_datetime64tz_dtype


def data_filters(tb_name, db, schema, filters=None, order_by=None, columns=None, datasource_id=None):
    # Transform list to set to remove duplicates
    if columns is not None:
        columns = list(dict.fromkeys(columns))

    if datasource_id is not None:
        sql_query =   text("""select CASE WHEN expression is null THEN column_name ELSE expression END as columns
                from table_columns
                where table_id = :datasource_id AND column_name IN :columns
                """).bindparams(bindparam("datasource_id"), bindparam('columns', expanding=True))

        data = dbs.session.execute(
                sql_query,
                {
                    "datasource_id": datasource_id,
                    "columns": list(columns) if columns is not None else "*"
                }
        ).fetchall() # https://docs.sqlalchemy.org/en/14/core/tutorial.html#using-textual-sql
        selected = ",".join([f'"{col["columns"]}"' for col in data]) if len(data) else "*"
    else:
        selected = ",".join([f'"{col}"' for col in columns]) if columns is not None else "*"

    from_table = f'"{schema}"."{tb_name}" ' if schema is not None else f'"{tb_name}"'
    query = "SELECT {} FROM {} ".format(selected, from_table)

    if filters is not None and len(filters) > 0:
        query += ' WHERE '
        for i in range(len(filters)):
            row = filters[i]
            expression_type = row["expressionType"]
            if expression_type == "SIMPLE":
                comparator = str(row["comparator"])
                subject = row["subject"]
                operator = row["operator"]

                if comparator == '' or operator == 'IS NULL':
                    query += f'"{subject}" IS NULL'
                elif operator == 'IS NOT NULL':
                    query += f'"{subject}" IS NOT NULL'
                elif operator == 'LIKE':
                    query += f'"{subject}" ' + f"LIKE '%{comparator}%'"
                elif operator == '==':
                    query += f'"{subject}" ' + f"= '{comparator}'"
                elif operator == '!=':
                    query += f'"{subject}" ' + f"<> '{comparator}'"
                elif operator == "in":
                    query += f'"{subject}" ' + f"IN {comparator.replace('[','(').replace(']',')')}"
                elif operator == "not in":
                    query += f'"{subject}" ' + f"NOT IN {comparator.replace('[','(').replace(']',')')}"

                # for < & > operator
                else:
                    query += f'"{subject}" {operator} ' + f"'{comparator}'"
            else:
                sql_expression = row["sqlExpression"]
                query += f"{sql_expression}"

            if i < len(filters)-1:
                query += " AND "

    if order_by is not None:
        query += " ORDER BY \"{}\"".format(order_by)

    row_limit = os.getenv("ANALYTIC_ROW_LIMIT", 1000000)
    query += f" LIMIT {row_limit}"
    df = db.get_df(query, schema)

    # Removing psycopg2.tz.FixedOffsetTimezone from the offsets of DateTime values
    tz_columns = df.apply(is_datetime64tz_dtype)
    df.loc[:, tz_columns] = df.loc[:, tz_columns].apply(lambda x : pd.to_datetime(x, utc=True))

    return df