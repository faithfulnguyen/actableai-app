import express from 'express';
import Viz from 'viz.js';
// eslint-disable-next-line import/extensions
import { Module, render } from 'viz.js/full.render.js';
import sharp from 'sharp';

const app = express();
const port = 3000;

const viz = new Viz({ Module, render });

app.get('/', async (req, res) => {
  const {
    format, engine, width, height, graph,
  } = req.query || {};
  if (!graph) {
    res.sendStatus(400);
    return;
  }
  try {
    const result = await viz.renderString(graph?.toString() || '', {
      format: 'svg',
      engine: engine?.toString() || 'dot',
    });
    if (format === 'png') {
      const img = sharp(Buffer.from(result));
      if (width && height) {
        img.resize({
          width: Number(width) || 100,
          height: Number(height) || 100,
          fit: 'contain',
          background: 'white',
        });
      }
      res.setHeader('content-type', 'image/png');
      const imgResult = await img.png().toBuffer();
      res.send(imgResult);
      return;
    }
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('content-type', 'image/svg+xml');
    res.send(result);
  } catch (e) {
    console.error((e as any).stack);
    res.status(500).send((e as any).message);
  }
});

app.get('/health', (_req, res) => { res.sendStatus(200); });

app.listen(port, () => {
  console.log(`charts service app listening at http://localhost:${port}`);
});
