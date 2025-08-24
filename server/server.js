import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

// ----- Models -----
const PostSchema = new mongoose.Schema({
  content: { type: String, required: true },
  userId: { type: String, required: true }, // author
  createdAt: { type: Date, default: Date.now }
});

const NotificationSchema = new mongoose.Schema({
  userId: { type: String, required: true }, // receiver
  type: { type: String, enum: ["post","like","comment","other"], required: true },
  actorId: { type: String, required: true },
  entity: { type: Object, default: null },
  title: { type: String, required: true },
  body: { type: String, default: "" },
  status: { type: String, enum: ["unread","read"], default: "unread", index: true },
  createdAt: { type: Date, default: Date.now, index: true }
});

NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, status: 1, createdAt: -1 });

const Post = mongoose.model("Post", PostSchema);
const Notification = mongoose.model("Notification", NotificationSchema);

// ----- App -----
const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 5000;

if (!MONGO_URI) {
  console.error("❌ Missing MONGO_URI. Set it in .env");
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => {
    console.error("Mongo connection error:", err);
    process.exit(1);
  });

app.get("/", (_req, res) => res.json({ ok: true, service: "insyd-notify-server" }));

// Create a post
app.post("/posts", async (req, res, next) => {
  try {
    const { userId, content } = req.body || {};
    if (!userId || !content) return res.status(400).json({ error: "userId and content are required" });
    const post = await Post.create({ userId, content });

    // Fanout: notify followers (POC: notify some demo users except author)
    const demoUsers = ["alice","bob","carol","dave"];
    const targets = demoUsers.filter(u => u !== userId);
    const docs = targets.map(u => ({
      userId: u,
      type: "post",
      actorId: userId,
      entity: { kind: "post", id: String(post._id) },
      title: `${userId} published a new post`,
      body: content.slice(0, 80)
    }));
    if (docs.length) await Notification.insertMany(docs);

    res.status(201).json(post);
  } catch (e) { next(e); }
});

// List posts (newest first)
app.get("/posts", async (_req, res, next) => {
  try {
    const posts = await Post.find({}).sort({ createdAt: -1 }).lean();
    res.json(posts);
  } catch (e) { next(e); }
});

// Like a post
app.post("/posts/:id/like", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { actorId } = req.body || {};
    if (!actorId) return res.status(400).json({ error: "actorId required" });

    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ error: "Post not found" });

    // Notify the author if liker != author
    if (post.userId !== actorId) {
      await Notification.create({
        userId: post.userId,
        type: "like",
        actorId,
        entity: { kind: "post", id },
        title: `${actorId} liked your post`,
        body: post.content.slice(0, 80)
      });
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Get notifications for a user
app.get("/notifications", async (req, res, next) => {
  try {
    const { userId, limit = 50 } = req.query;
    if (!userId) return res.status(400).json({ error: "userId is required" });
    const lim = Math.min(parseInt(limit, 10) || 50, 100);
    const items = await Notification.find({ userId }).sort({ createdAt: -1 }).limit(lim).lean();
    res.json(items);
  } catch (e) { next(e); }
});

// Mark single notification read
app.patch("/notifications/:id/read", async (req, res, next) => {
  try {
    const { id } = req.params;
    const upd = await Notification.findByIdAndUpdate(id, { status: "read" }, { new: true });
    if (!upd) return res.status(404).json({ error: "Not found" });
    res.json(upd);
  } catch (e) { next(e); }
});

// Mark all as read for user
app.patch("/notifications/read-all", async (req, res, next) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId is required" });
    const result = await Notification.updateMany({ userId, status: "unread" }, { $set: { status: "read" } });
    res.json({ modifiedCount: result.modifiedCount });
  } catch (e) { next(e); }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal Server Error" });
});

app.listen(PORT, () => console.log(`🚀 Server on http://localhost:${PORT}`));