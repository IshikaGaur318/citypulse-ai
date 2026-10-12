
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "CityPulse AI backend is running!"
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    project: "CityPulse AI",
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`CityPulse AI backend running on http://localhost:${PORT}`);
});