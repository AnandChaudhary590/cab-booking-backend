
const express = require('express')
const pool = require('../config/db')
const authMiddleware = require('../middleware/authMiddleware')

const router = express.Router()

// Every payment request requires login
router.use(authMiddleware)

// Create a payment record for the logged-in rider's completed ride
router.post('/', async (req, res) => {
  try {
    if (req.user.role !== 'rider') {
      return res.status(403).json({
        success: false,
        message: 'Only riders can create payment records.',
      })
    }

    const { rideId, paymentMethod } = req.body
    const numericRideId = Number(rideId)

    if (
      !Number.isSafeInteger(numericRideId) ||
      numericRideId <= 0 ||
      !['cash', 'upi'].includes(paymentMethod)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Valid rideId and paymentMethod (cash/upi) are required.',
      })
    }

    // Verify ride ownership and completion
    const rideResult = await pool.query(
      `SELECT id, fare, status
       FROM rides
       WHERE id = $1 AND rider_id = $2`,
      [numericRideId, req.user.userId]
    )

    if (rideResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found for this rider.',
      })
    }

    const ride = rideResult.rows[0]

    if (ride.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Payment can be created only for completed rides.',
      })
    }

    const amount = Number(ride.fare)

    if (!Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid ride fare is unavailable.',
      })
    }

    // Do not create duplicate payment records
    const existing = await pool.query(
      `SELECT id, ride_id, payment_method, amount, payment_status, created_at
       FROM payments
       WHERE ride_id = $1
       LIMIT 1`,
      [numericRideId]
    )

    if (existing.rows.length > 0) {
      return res.json({
        success: true,
        message: 'Payment record already exists.',
        payment: existing.rows[0],
      })
    }

    const result = await pool.query(
      `INSERT INTO payments
         (ride_id, payment_method, amount, payment_status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING id, ride_id, payment_method, amount,
                 payment_status, created_at`,
      [numericRideId, paymentMethod, amount]
    )

    return res.status(201).json({
      success: true,
      message: 'Payment record created. Payment is still pending.',
      payment: result.rows[0],
    })
  } catch (error) {
    console.error('Create payment error:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Could not create payment record.',
    })
  }
})

// View payment details for the logged-in rider's ride
router.get('/:rideId', async (req, res) => {
  try {
    if (req.user.role !== 'rider') {
      return res.status(403).json({
        success: false,
        message: 'Only riders can view these payment details.',
      })
    }

    const rideId = Number(req.params.rideId)

    if (!Number.isSafeInteger(rideId) || rideId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ride ID.',
      })
    }

    const result = await pool.query(
      `SELECT p.id, p.ride_id, p.payment_method, p.amount,
              p.payment_status, p.created_at
       FROM payments p
       JOIN rides r ON r.id = p.ride_id
       WHERE p.ride_id = $1 AND r.rider_id = $2
       LIMIT 1`,
      [rideId, req.user.userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found.',
      })
    }

    return res.json({
      success: true,
      payment: result.rows[0],
    })
  } catch (error) {
    console.error('Get payment error:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Could not fetch payment details.',
    })
  }
})

module.exports = router
