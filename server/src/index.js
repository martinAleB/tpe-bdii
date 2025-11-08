import express from "express";
import { MongoClient } from "mongodb";
import Redis from "ioredis";
import dotenv from "dotenv";
dotenv.config();

const PORT = process.env.PORT || 3000;
const MONGO_URL = process.env.MONGO_URL || "mongodb://mongo:27017/aseguradora";
const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";

const app = express();
app.use(express.json());

const mongoClient = new MongoClient(MONGO_URL);
await mongoClient.connect();
const db = mongoClient.db();
const col = db.collection("agentes");

const redis = new Redis(REDIS_URL);

app.get("/", (req, res) => res.send("OK"));

app.get("/mongo", async (_req, res) => {
  try {
    const docs = await col.find().toArray();
    res.json(docs);
  } catch (err) {
    console.error("Error fetching documents from MongoDB", err);
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

app.get("/redis", async (_req, res) => {
  const n = await redis.incr("hits");
  res.json({ hits: n });
});

app.listen(PORT, () =>
  console.log(`Server listening on http://localhost:${PORT}`)
);
