
const pool = require('../config/db')

const createUser = async (req, res) => {
  try {
    const { full_name, email, phone, role } = req.body

    if (!full_name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Full name and email are required',
      })
    }

    const result = await pool.query(
      `INSERT INTO users (full_name, email, phone, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, full_name, email, phone, role, created_at`,
      [full_name.trim(), email.trim().toLowerCase(), phone || null, role || 'rider']
    )

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: result.rows[0],
    })
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Email or phone number already exists',
      })
    }

    console.error('Create user error:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Failed to create user',
    })
  }
}

const getUsers = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, email, phone, role, created_at
       FROM users
       ORDER BY id DESC`
    )

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      users: result.rows,
    })
  } catch (error) {
    console.error('Get users error:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
    })
  }
}

module.exports = { createUser, getUsers }
