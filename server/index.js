require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { spawn } = require('child_process');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

if (!process.env.MONGODB_URI) {
  console.error('Missing MONGODB_URI in server/.env');
  process.exit(1);
}

const mongoClient = new MongoClient(process.env.MONGODB_URI);

let db;
let metricsCollection;
let historyCollection;

const defaultMetrics = [
  { name: 'Traffic flow', value: 75, unit: '%' },
  { name: 'Air quality', value: 67, unit: 'AQI' },
  { name: 'Energy usage', value: 63, unit: '%' },
  { name: 'Water reserves', value: 83, unit: '%' },
];

async function connectDatabase() {
  await mongoClient.connect();

  db = mongoClient.db('citypulse');
  metricsCollection = db.collection('metrics');
  historyCollection = db.collection('history');

  if ((await metricsCollection.countDocuments()) === 0) {
    await metricsCollection.insertMany(defaultMetrics);
  }

  await historyCollection.createIndex({ createdAt: -1 });

  console.log('MongoDB connected successfully!');
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    project: 'CityPulse AI',
    database: db ? 'Connected' : 'Disconnected',
    timestamp: new Date().toISOString(),
  });
});

// Current metrics
app.get('/api/metrics', async (req, res) => {
  try {
    const metrics = await metricsCollection
      .find({}, { projection: { _id: 0 } })
      .toArray();

    res.json({
      success: true,
      metrics,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Could not load metrics:', error.message);

    res.status(500).json({
      success: false,
      message: 'Could not load metrics',
    });
  }
});

// Simulate updated city metrics and save history
app.post('/api/simulate', async (req, res) => {
  try {
    const currentMetrics = await metricsCollection.find({}).toArray();
    const updatedAt = new Date();

    const updatedMetrics = currentMetrics.map((metric) => {
      const change = Math.floor(Math.random() * 11) - 5;
      const maxValue = metric.name === 'Air quality' ? 500 : 100;

      const value = Math.max(
        0,
        Math.min(maxValue, Number(metric.value) + change)
      );

      return {
        name: metric.name,
        value,
        unit: metric.unit,
        updatedAt,
      };
    });

    for (const metric of updatedMetrics) {
      await metricsCollection.updateOne(
        { name: metric.name },
        {
          $set: {
            value: metric.value,
            unit: metric.unit,
            updatedAt,
          },
        },
        { upsert: true }
      );
    }

    const historyRecord = {
      metrics: updatedMetrics.map(({ name, value, unit }) => ({
        name,
        value,
        unit,
      })),
      createdAt: updatedAt,
    };

    const result = await historyCollection.insertOne(historyRecord);

    res.json({
      success: true,
      historyId: result.insertedId,
      metrics: historyRecord.metrics,
      updatedAt: updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Simulation failed:', error.message);

    res.status(500).json({
      success: false,
      message: 'Simulation failed',
    });
  }
});

// Historical readings
app.get('/api/history', async (req, res) => {
  try {
    const history = await historyCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.json({
      success: true,
      count: history.length,
      history,
    });
  } catch (error) {
    console.error('Could not load history:', error.message);

    res.status(500).json({
      success: false,
      message: 'Could not load history',
    });
  }
});

// AI predictions
app.get('/api/ai/predictions', async (req, res) => {
  try {
    const history = await historyCollection
      .find({})
      .sort({ createdAt: 1 })
      .toArray();

    const metricNames = [
      'Traffic flow',
      'Air quality',
      'Energy usage',
      'Water reserves',
    ];

    const pythonPath = path.resolve(
      __dirname,
      '..',
      '.venv',
      'bin',
      'python'
    );

    const modelPath = path.resolve(
      __dirname,
      '..',
      'ai_model.py'
    );

    const predictions = await Promise.all(
      metricNames.map(async (name) => {
        const values = history
          .flatMap((record) => record.metrics || [])
          .filter(
            (item) =>
              item.name === name &&
              item.value !== null &&
              item.value !== undefined &&
              Number.isFinite(Number(item.value))
          )
          .map((item) => Number(item.value));

        return new Promise((resolve, reject) => {
          const python = spawn(pythonPath, [modelPath]);

          let output = '';
          let errorOutput = '';

          python.stdout.on('data', (data) => {
            output += data.toString();
          });

          python.stderr.on('data', (data) => {
            errorOutput += data.toString();
          });

          python.on('error', (error) => {
            reject(error);
          });

          python.on('close', (code) => {
            if (code !== 0) {
              reject(
                new Error(
                  errorOutput || `Python exited with code ${code}`
                )
              );
              return;
            }

            try {
              const result = JSON.parse(output.trim());

              if (
                result.ready === false ||
                typeof result.prediction !== 'number'
              ) {
                reject(
                  new Error(
                    `Prediction unavailable for ${name}: ${
                      result.message || output.slice(0, 200)
                    }`
                  )
                );
                return;
              }

              resolve({
                name,
                prediction: result.prediction,
                readings: values.length,
                model: result.model,
                ready: result.ready,
              });
            } catch (error) {
              reject(
                new Error(
                  `Invalid Python output for ${name}: ${error.message}`
                )
              );
            }
          });

          python.stdin.on('error', (error) => {
            if (error.code !== 'EPIPE') {
              console.error('Python input error:', error.message);
            }
          });

          python.stdin.end(JSON.stringify({ values }));
        });
      })
    );

    console.log(
      'AI predictions generated:',
      JSON.stringify(predictions)
    );

    res.json({
      success: true,
      predictions,
    });
  } catch (error) {
    console.error('AI predictions error:', error.message);

    res.status(500).json({
      success: false,
      message: 'Could not generate AI predictions',
      error: error.message,
    });
  }
});

// Unknown routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found: ' + req.method + ' ' + req.originalUrl,
  });
});

// Start server
async function startServer() {
  try {
    await connectDatabase();

    app.listen(PORT, () => {
      console.log(
        'CityPulse AI backend running on http://localhost:' + PORT
      );
      console.log('GET /api/health');
      console.log('GET /api/metrics');
      console.log('POST /api/simulate');
      console.log('GET /api/history');
      console.log('GET /api/ai/predictions');
    });
  } catch (error) {
    console.error('Startup failed:', error.message);

    await mongoClient.close().catch(() => {});
    process.exit(1);
  }
}

startServer();