import { useEffect, useState } from 'react';
import axios from 'axios';
import { SupersetClient } from '@superset-ui/connection';
import { updateTaskid } from 'src/chart/chartAction';

interface IUseChartsProps<TChartData extends TAnalysisResult> {
  actions: Record<string, (...values: any[]) => any>;
  chart: any;
  vizType: string;
  processChartData?: (chartData: ITaskDetails<TChartData>) => ITaskDetails<TChartData>;
}

export function useChart<TChartData extends TAnalysisResult>({ actions, chart, vizType, processChartData }: IUseChartsProps<TChartData>) {
  const [chartData, setChartData] = useState<ITaskDetails<TChartData> | undefined>(undefined);
  const [isReQuery, setIsReQuery] = useState(true);

  const endpoint = `/${vizType}/api/task/${chart.queryResponse.data.taskId}`;

  const reQuery = () => {
    if (isReQuery) {
      setIsReQuery(false);
      deleteTask();
      actions.setTaskId(chart.id, null);
      actions.triggerQuery(true, chart.id);
    }
  }

  const deleteTask = () => {
    if(chartData?.status && !["SUCCESS", "FAILURE"].includes(chartData?.status)){
      axios.delete(`/api/task/${chart.queryResponse.data.taskId}`);
    }
  }

  const stopQuery = (message?: string) => {
    deleteTask();
    actions.setPollingStatus(chart.id, false);
    actions.chartRenderingFailed(message, chart.id, null);
  }

  const pollTaskStatus = async () => {
    const result = await SupersetClient.get({ endpoint });
    const chartData = result.json as ITaskDetails<TChartData>;
    setChartData(processChartData?.(chartData) || chartData);
  }

  const onProcessing = async () => {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    pollTaskStatus();
  }

  const onSuccess = () => {
    actions.chartUpdateData(chartData, chart.id);
    actions.setPollingStatus(chart.id, false);
    if (!isReQuery) {
      updateTaskid(chart.id, chart.queryResponse.data.taskId);
    }

  }

  const onPending = async () => {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await pollTaskStatus();
    reQuery();
  }

  const onRetryOrRevoked = () => {
    if (chartData?.status === 'RETRY') {
      reQuery();
    }
  }

  const onFailed = () => {
    let validation_message = '';

    const validations = chartData?.validations || [];
    for (let i = 0; i < validations.length; i++) {
      validation_message += `\n ${validations[i].level}: ${validations[i].message}`;
    }
    const message = validations.length > 0
      ? validation_message
      : chartData?.messenger;
    stopQuery(message);
  }

  const setData = (nextTaskId: string) => {
    actions.setPollingStatus(chart.id, true);
    actions.setTaskId(chart.id, nextTaskId);
    pollTaskStatus();
  }

  useEffect(() => {
    if (!chartData) return;
    if (chartData.status === 'SUCCESS' && chartData.data) {
      onSuccess();
    } else if ( chartData.status === 'PENDING') {
      onPending();
    } else if (chartData.status === 'RETRY' || chartData.status === 'REVOKED') {
      onRetryOrRevoked();
    } else if (chartData.status === 'FAILURE') {
      onFailed();
    } else {
      onProcessing();
    }
  }, [chartData])

  useEffect(() => {
    setData(chart.queryResponse.data.taskId);
  }, [chart.queryResponse.data.taskId])

  return { chartData, reQuery, setChartData }
}