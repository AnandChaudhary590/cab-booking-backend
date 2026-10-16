
const pool = require('../config/db')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const createUser = async (req, res) => {
  try {
    const { full_name, email, phone, password } = req.body

    if (!full_name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({
        success: false,
        message: 'Full name, email and password are required',
      })
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters',
      })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const passwordHash = await bcrypt.hash(password, 12)

    const result = await pool.query(
      `INSERT INTO users
        (full_name, email, phone, role, password_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, full_name, email, phone, role, created_at`,
      [
        full_name.trim(),
        normalizedEmail,
        phone?.trim() || null,
        'rider',
        passwordHash,
      ]
    )

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
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
      message: 'Failed to register user',
    })
  }
}

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email?.trim() || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      })
    }

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is missing from environment')
      return res.status(500).json({
        success: false,
        message: 'Server authentication is not configured',
      })
    }

    const normalizedEmail = email.trim().toLowerCase()

    const result = await pool.query(
      `SELECT id, full_name, email, phone, role,
              password_hash, created_at
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [normalizedEmail]
    )

    const user = result.rows[0]

    if (!user || !user.password_hash) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      })
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    )

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      })
    }

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    )

    const { password_hash, ...safeUser } = user

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: safeUser,
    })
  } catch (error) {
    console.error('Login error:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.',
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


const getMe = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, email, phone, role, created_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [req.user.userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      })
    }

    return res.status(200).json({
      success: true,
      user: result.rows[0],
    })
  } catch (error) {
    console.error('Get profile error:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
    })
  }
}


module.exports = { createUser, loginUser, getUsers,  getMe }
