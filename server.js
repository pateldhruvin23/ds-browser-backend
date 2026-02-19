require("dotenv").config()

const express = require("express")
const cors = require("cors")
const { Pool } = require("pg")

const app = express()

app.use(cors())
app.use(express.json())

/* ============================
   DATABASE CONNECTION
============================ */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

/* ============================
   HELPER FUNCTION
   Get internal UUID from firebase_uid
============================ */

async function getUserId(firebase_uid) {
  const result = await pool.query(
    "SELECT id FROM users WHERE firebase_uid = $1",
    [firebase_uid]
  )

  if (result.rows.length === 0) return null

  return result.rows[0].id
}

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

// Create or update user
app.post("/users", async (req, res) => {
  try {
    const { firebase_uid, email, name, profile_image, login_provider } = req.body

    const result = await pool.query(
      `
      INSERT INTO users
      (firebase_uid, email, name, profile_image, login_provider)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (firebase_uid)
      DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        profile_image = EXCLUDED.profile_image,
        login_provider = EXCLUDED.login_provider
      RETURNING *
      `,
      [firebase_uid, email, name, profile_image, login_provider]
    )

    res.json(result.rows[0])

  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get user
app.get("/users/:firebase_uid", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE firebase_uid = $1",
      [req.params.firebase_uid]
    )

    res.json(result.rows[0])

  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/* ============================
   SHORTCUTS
============================ */

// Get shortcuts
app.get("/shortcuts/:firebase_uid", async (req, res) => {
  try {
    const user_id = await getUserId(req.params.firebase_uid)

    if (!user_id)
      return res.status(404).json({ error: "User not found" })

    const result = await pool.query(
      `
      SELECT *
      FROM shortcuts
      WHERE user_id = $1
      ORDER BY is_pinned DESC, created_at DESC
      `,
      [user_id]
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

    const user_id = await getUserId(firebase_uid)

    if (!user_id)
      return res.status(404).json({ error: "User not found" })

    const result = await pool.query(
      `
      INSERT INTO shortcuts
      (user_id, title, url, icon, is_pinned)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [user_id, title, url, icon, is_pinned || false]
    )

    res.json(result.rows[0])

  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Update shortcut
app.put("/shortcuts/:id", async (req, res) => {
  try {
    const { title, url, icon, is_pinned } = req.body

    const result = await pool.query(
      `
      UPDATE shortcuts
      SET title=$1, url=$2, icon=$3, is_pinned=$4
      WHERE id=$5
      RETURNING *
      `,
      [title, url, icon, is_pinned, req.params.id]
    )

    res.json(result.rows[0])

  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Delete shortcut
app.delete("/shortcuts/:id", async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM shortcuts WHERE id=$1",
      [req.params.id]
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
app.get("/history/:firebase_uid", async (req, res) => {
  try {
    const user_id = await getUserId(req.params.firebase_uid)

    if (!user_id)
      return res.status(404).json({ error: "User not found" })

    const result = await pool.query(
      `
      SELECT *
      FROM history
      WHERE user_id=$1
      ORDER BY visited_at DESC
      `,
      [user_id]
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

    const user_id = await getUserId(firebase_uid)

    if (!user_id)
      return res.status(404).json({ error: "User not found" })

    const result = await pool.query(
      `
      INSERT INTO history
      (user_id, title, url)
      VALUES ($1, $2, $3)
      RETURNING *
      `,
      [user_id, title, url]
    )

    res.json(result.rows[0])

  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/* ============================
   SETTINGS
============================ */

// Get settings
app.get("/settings/:firebase_uid", async (req, res) => {
  try {
    const user_id = await getUserId(req.params.firebase_uid)

    if (!user_id)
      return res.status(404).json({ error: "User not found" })

    const result = await pool.query(
      "SELECT * FROM settings WHERE user_id=$1",
      [user_id]
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
      use_24_hour_time,
      theme
    } = req.body

    const user_id = await getUserId(firebase_uid)

    if (!user_id)
      return res.status(404).json({ error: "User not found" })

    const result = await pool.query(
      `
      INSERT INTO settings
      (user_id, face_id_enabled, use_24_hour_time, theme)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (user_id)
      DO UPDATE SET
        face_id_enabled=$2,
        use_24_hour_time=$3,
        theme=$4,
        updated_at=NOW()
      RETURNING *
      `,
      [user_id, face_id_enabled, use_24_hour_time, theme]
    )

    res.json(result.rows[0])

  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/* ============================
   START SERVER
============================ */

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log("Server running on port", PORT)
})
