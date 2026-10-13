
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const pool = require('./config/db')
const userRoutes = require('./routes/userRoutes')

const app = express()

app.use(helmet())
app.use(cors({
  origin: 'http://localhost:5173',
}))
app.use(express.json())
app.use(morgan('dev'))

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Cab Booking API is running!',
  })
})

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Cab Booking Backend is healthy!',
  })
})

app.get('/api/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS current_time')

    res.json({
      success: true,
      message: 'Supabase database connected successfully!',
      time: result.rows[0].current_time,
    })
  } catch (error) {
    console.error('Database connection failed:', error.message)

    res.status(500).json({
      success: false,
      message: 'Database connection failed',
    })
  }
})

app.use('/api/users', userRoutes)

module.exports = app
