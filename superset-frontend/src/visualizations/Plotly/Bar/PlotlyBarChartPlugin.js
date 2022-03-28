import { t } from '@superset-ui/translation';
import { ChartMetadata, ChartPlugin } from '@superset-ui/chart';
// import transformProps from './transformProps';
import thumbnail from './images/thumbnail.png';

const metadata = new ChartMetadata({
    name: t('Bar Chart'),
    description: '',
    thumbnail,
});

class PlotlyBarChartPlugin extends ChartPlugin {
    constructor() {
        super({
            metadata,
            loadChart: import('./PlotlyBar.js'),
        });
    }

}

export default PlotlyBarChartPlugin;
