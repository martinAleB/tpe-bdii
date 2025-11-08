import express from "express";
import { MongoClient } from "mongodb";
import Redis from "ioredis";
import dotenv from "dotenv";
dotenv.config();

const PORT = process.env.PORT || 3000;
const MONGO_URL = process.env.MONGO_URL || "mongodb://mongo:27017/mydb";
const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";

const app = express();
app.use(express.json());

const mongoClient = new MongoClient(MONGO_URL);
await mongoClient.connect();
const db = mongoClient.db();
const col = db.collection("ping");

const redis = new Redis(REDIS_URL);

app.get("/", (req, res) => res.send("OK"));

app.get("/mongo", async (_req, res) => {
  const doc = { ts: new Date() };
  await col.insertOne(doc);
  const count = await col.countDocuments();
  res.json({ inserted: doc, count });
});

app.get("/redis", async (_req, res) => {
  const n = await redis.incr("hits");
  res.json({ hits: n });
});

app.listen(PORT, () =>
  console.log(`Server listening on http://localhost:${PORT}`)
);
