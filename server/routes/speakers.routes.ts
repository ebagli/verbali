import express from "express";
import { authMiddleware, type AuthRequest } from "../auth.js";
import { db } from "../db.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", (req: AuthRequest, res) => {
  try {
    const speakers = db.prepare(`
      SELECT * FROM speakers
      WHERE user_id = ?
      ORDER BY full_name
    `).all(req.userId);

    res.json(speakers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/", (req: AuthRequest, res) => {
  try {
    const { full_name, title } = req.body;
    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO speakers (id, user_id, full_name, title)
      VALUES (?, ?, ?, ?)
    `).run(id, req.userId, full_name, title || "");

    const created = db.prepare(`SELECT * FROM speakers WHERE id = ?`).get(id);
    res.json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:id", (req: AuthRequest, res) => {
  try {
    db.prepare(`
      DELETE FROM speakers WHERE id = ? AND user_id = ?
    `).run(req.params.id, req.userId);

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
