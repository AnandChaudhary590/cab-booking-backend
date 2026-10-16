
const express = require('express')
const authMiddleware = require('../middleware/authMiddleware')
const {
  createRide,
  getMyRides,
  getAvailableRides,
  getDriverRides,
  acceptRide,
  rejectRide,
  calculateFare,
  startRide,
  completeRide,
  cancelRide,
} = require('../controllers/rideController')

const router = express.Router()

// All ride routes require a valid login token.
router.use(authMiddleware)

// Rider routes
router.post('/', (req, res, next) => {
  if (req.user.role !== 'rider') {
    return res.status(403).json({
      success: false,
      message: 'Only riders can book rides',
    })
  }

  next()
}, createRide)

router.get('/my-rides', (req, res, next) => {
  if (req.user.role !== 'rider') {
    return res.status(403).json({
      success: false,
      message: 'Only riders can view their ride history',
    })
  }

  next()
}, getMyRides)

// Driver routes
router.get('/available', (req, res, next) => {
  if (req.user.role !== 'driver') {
    return res.status(403).json({
      success: false,
      message: 'Only drivers can view available rides',
    })
  }

  next()
}, getAvailableRides)

// Get rides already assigned to this driver
router.get('/driver-rides', (req, res, next) => {
  if (req.user.role !== 'driver') {
    return res.status(403).json({
      success: false,
      message: 'Only drivers can view their assigned rides',
    })
  }

  next()
}, getDriverRides)

router.patch('/:id/accept', (req, res, next) => {
  if (req.user.role !== 'driver') {
    return res.status(403).json({
      success: false,
      message: 'Only drivers can accept rides',
    })
  }

  next()
}, acceptRide)

router.patch('/:id/reject', (req, res, next) => {
  if (req.user.role !== 'driver') {
    return res.status(403).json({
      success: false,
      message: 'Only drivers can reject rides',
    })
  }

  next()
}, rejectRide)

// Rider: Calculate fare for an accepted ride
router.patch('/:id/fare', (req, res, next) => {
  if (req.user.role !== 'rider') {
    return res.status(403).json({
      success: false,
      message: 'Only riders can calculate fares',
    })
  }

  next()
}, calculateFare)


// Rider: Cancel a ride
router.patch('/:id/cancel', (req, res, next) => {
  if (req.user.role !== 'rider') {
    return res.status(403).json({
      success: false,
      message: 'Only riders can cancel rides',
    })
  }

  next()
}, cancelRide)

// Driver: Start an accepted ride
router.patch('/:id/start', (req, res, next) => {
  if (req.user.role !== 'driver') {
    return res.status(403).json({
      success: false,
      message: 'Only drivers can start rides',
    })
  }

  next()
}, startRide)

// Driver: Complete an ongoing ride
router.patch('/:id/complete', (req, res, next) => {
  if (req.user.role !== 'driver') {
    return res.status(403).json({
      success: false,
      message: 'Only drivers can complete rides',
    })
  }

  next()
}, completeRide)

module.exports = router