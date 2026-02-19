require("dotenv").config()

const express = require("express")
const cors = require("cors")
const { Pool } = require("pg")

const app = express()

app.use(cors())
app.use(express.json())

// Neon PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
})

/* ============================
   HEALTH CHECK
============================ */

app.get("/", (req, res) => {
  res.send("D’s Browser Backend Running 🚀")
})

app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()")
    res.json(result.rows)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/* ============================
   USERS
============================ */

// Create user
app.post("/users", async (req, res) => {
  try {
    const { firebase_uid, email, name, provider } = req.body

    await pool.query(
      `
      INSERT INTO users (firebase_uid, email, name, provider)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (firebase_uid)
      DO NOTHING
      `,
      [firebase_uid, email, name, provider]
    )

    res.json({ message: "User saved" })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get user
app.get("/users/:uid", async (req, res) => {
  try {
    const { uid } = req.params

    const result = await pool.query(
      "SELECT * FROM users WHERE firebase_uid = $1",
      [uid]
    )

    res.json(result.rows[0])
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/* ============================
   SHORTCUTS
============================ */

// Get all shortcuts
app.get("/shortcuts/:uid", async (req, res) => {
  try {
    const { uid } = req.params

    const result = await pool.query(
      `
      SELECT * FROM shortcuts
      WHERE firebase_uid = $1
      ORDER BY is_pinned DESC, created_at DESC
      `,
      [uid]
    )

    res.json(result.rows)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Add shortcut
app.post("/shortcuts", async (req, res) => {
  try {
    const { firebase_uid, title, url, icon, is_pinned } = req.body

    await pool.query(
      `
      INSERT INTO shortcuts
      (firebase_uid, title, url, icon, is_pinned)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [firebase_uid, title, url, icon, is_pinned]
    )

    res.json({ message: "Shortcut saved" })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Update shortcut
app.put("/shortcuts/:id", async (req, res) => {
  try {
    const { id } = req.params
    const { title, url, icon, is_pinned } = req.body

    await pool.query(
      `
      UPDATE shortcuts
      SET title = $1,
          url = $2,
          icon = $3,
          is_pinned = $4
      WHERE id = $5
      `,
      [title, url, icon, is_pinned, id]
    )

    res.json({ message: "Shortcut updated" })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Delete shortcut
app.delete("/shortcuts/:id", async (req, res) => {
  try {
    const { id } = req.params

    await pool.query(
      "DELETE FROM shortcuts WHERE id = $1",
      [id]
    )

    res.json({ message: "Shortcut deleted" })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/* ============================
   HISTORY
============================ */

// Get history
app.get("/history/:uid", async (req, res) => {
  try {
    const { uid } = req.params

    const result = await pool.query(
      `
      SELECT * FROM history
      WHERE firebase_uid = $1
      ORDER BY visited_at DESC
      `,
      [uid]
    )

    res.json(result.rows)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Save history
app.post("/history", async (req, res) => {
  try {
    const { firebase_uid, title, url } = req.body

    await pool.query(
      `
      INSERT INTO history
      (firebase_uid, title, url)
      VALUES ($1, $2, $3)
      `,
      [firebase_uid, title, url]
    )

    res.json({ message: "History saved" })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/* ============================
   SETTINGS
============================ */

// Get settings
app.get("/settings/:uid", async (req, res) => {
  try {
    const { uid } = req.params

    const result = await pool.query(
      "SELECT * FROM settings WHERE firebase_uid = $1",
      [uid]
    )

    res.json(result.rows[0])
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Save settings
app.post("/settings", async (req, res) => {
  try {
    const {
      firebase_uid,
      face_id_enabled,
      use_24h,
      theme
    } = req.body

    await pool.query(
      `
      INSERT INTO settings
      (firebase_uid, face_id_enabled, use_24h, theme)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (firebase_uid)
      DO UPDATE SET
      face_id_enabled = $2,
      use_24h = $3,
      theme = $4
      `,
      [firebase_uid, face_id_enabled, use_24h, theme]
    )

    res.json({ message: "Settings saved" })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/* ============================
   START SERVER
============================ */

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
