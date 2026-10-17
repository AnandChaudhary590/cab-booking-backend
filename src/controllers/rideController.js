const pool = require('../config/db')

// Rider: Create a new ride

const createRide = async (req, res) => {
  try {
    const {
      pickup_address,
      dropoff_address,
      pickup_lat,
      pickup_lng,
      dropoff_lat,
      dropoff_lng,
    } = req.body

    if (
      typeof pickup_address !== 'string' ||
      typeof dropoff_address !== 'string' ||
      !pickup_address.trim() ||
      !dropoff_address.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: 'Pickup and drop-off addresses are required',
      })
    }

    if (
      pickup_address.trim().length > 500 ||
      dropoff_address.trim().length > 500
    ) {
      return res.status(400).json({
        success: false,
        message: 'Addresses must be 500 characters or fewer',
      })
    }

    const coordinates = [
      pickup_lat,
      pickup_lng,
      dropoff_lat,
      dropoff_lng,
    ]

    const validCoordinates = coordinates.every(
      (value) =>
        value !== null &&
        value !== undefined &&
        value !== '' &&
        Number.isFinite(Number(value))
    )

    if (!validCoordinates) {
      return res.status(400).json({
        success: false,
        message: 'Please select pickup and destination on the map',
      })
    }

    const [pickupLat, pickupLng, dropoffLat, dropoffLng] =
      coordinates.map(Number)

    if (
      Math.abs(pickupLat) > 90 ||
      Math.abs(dropoffLat) > 90 ||
      Math.abs(pickupLng) > 180 ||
      Math.abs(dropoffLng) > 180
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid location coordinates',
      })
    }

    const routeUrl =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${pickupLng},${pickupLat};${dropoffLng},${dropoffLat}` +
      '?overview=false'

    const routeResponse = await fetch(routeUrl, {
      signal: AbortSignal.timeout(10000),
    })

    if (!routeResponse.ok) {
      throw new Error('Routing service unavailable')
    }

    const routeData = await routeResponse.json()

    if (routeData.code !== 'Ok' || !routeData.routes?.length) {
      return res.status(400).json({
        success: false,
        message: 'No driving route found for these locations',
      })
    }

    const distanceKm = routeData.routes[0].distance / 1000

    if (
      !Number.isFinite(distanceKm) ||
      distanceKm <= 0 ||
      distanceKm > 1000
    ) {
      return res.status(400).json({
        success: false,
        message: 'Route distance must be greater than 0 and at most 1000 km',
      })
    }

    const fare = Math.max(70, Math.round(50 + distanceKm * 12))

    const result = await pool.query(
      `INSERT INTO rides
        (rider_id, pickup_address, dropoff_address, fare)
       VALUES ($1, $2, $3, $4)
       RETURNING id, rider_id, pickup_address, dropoff_address,
                 status, fare, created_at`,
      [
        req.user.userId,
        pickup_address.trim(),
        dropoff_address.trim(),
        fare,
      ]
    )

    return res.status(201).json({
      success: true,
      message: 'Ride requested successfully',
      distance_km: Number(distanceKm.toFixed(2)),
      estimated_duration_minutes: Math.ceil(
        routeData.routes[0].duration / 60
      ),
      fare_breakdown: {
        base_fare: 50,
        per_km_rate: 12,
        minimum_fare: 70,
        total_fare: fare,
      },
      ride: result.rows[0],
    })
  } catch (error) {
    console.error('Create ride error:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Failed to create ride or calculate route',
    })
  }
}

// Rider: View their own rides
const getMyRides = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, rider_id, driver_id, pickup_address, dropoff_address,
              status, fare, created_at, updated_at
       FROM rides
       WHERE rider_id = $1
       ORDER BY created_at DESC`,
      [req.user.userId]
    )

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      rides: result.rows,
    })
  } catch (error) {
    console.error('Get rides error:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch rides',
    })
  }
}


// Driver: View available ride requests
const getAvailableRides = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         r.id,
         r.rider_id,
         u.full_name AS rider_name,
         r.pickup_address,
         r.dropoff_address,
         r.status,
         r.fare,
         r.created_at
       FROM rides r
       JOIN users u ON u.id = r.rider_id
       WHERE r.status = 'requested'
         AND r.rider_id <> $1
       ORDER BY r.created_at ASC`,
      [req.user.userId]
    )

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      rides: result.rows,
    })
  } catch (error) {
    console.error('Available rides error:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch available rides',
    })
  }
}

// Driver: Accept a ride
const acceptRide = async (req, res) => {
  try {
    const { id } = req.params

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ride ID',
      })
    }

    const result = await pool.query(
      `UPDATE rides
       SET status = 'accepted',
           driver_id = $1,
           updated_at = NOW()
       WHERE id = $2
         AND status = 'requested'
         AND rider_id <> $1
       RETURNING id, rider_id, driver_id, pickup_address,
                 dropoff_address, status, fare, updated_at`,
      [req.user.userId, id]
    )

    if (result.rowCount === 0) {
      return res.status(409).json({
        success: false,
        message: 'Ride is no longer available to accept',
      })
    }

    return res.status(200).json({
      success: true,
      message: 'Ride accepted successfully',
      ride: result.rows[0],
    })
  } catch (error) {
    console.error('Accept ride error:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Failed to accept ride',
    })
  }
}

// Driver: Reject a ride request
const rejectRide = async (req, res) => {
  try {
    const { id } = req.params

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ride ID',
      })
    }

    const result = await pool.query(
      `UPDATE rides
       SET status = 'rejected',
           updated_at = NOW()
       WHERE id = $1
         AND status = 'requested'
         AND rider_id <> $2
       RETURNING id, rider_id, pickup_address, dropoff_address,
                 status, updated_at`,
      [id, req.user.userId]
    )

    if (result.rowCount === 0) {
      return res.status(409).json({
        success: false,
        message: 'Ride is no longer available to reject',
      })
    }

    return res.status(200).json({
      success: true,
      message: 'Ride rejected successfully',
      ride: result.rows[0],
    })
  } catch (error) {
    console.error('Reject ride error:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Failed to reject ride',
    })
  }
}

// Rider: Calculate fare for an accepted ride
const calculateFare = async (req, res) => {
  try {
    const { id } = req.params
    const { distance_km } = req.body

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ride ID',
      })
    }

    const distance = Number(distance_km)

    if (
      !Number.isFinite(distance) ||
      distance <= 0 ||
      distance > 1000
    ) {
      return res.status(400).json({
        success: false,
        message: 'Distance must be greater than 0 and at most 1000 km',
      })
    }

    const baseFare = 50
    const perKmRate = 12
    const minimumFare = 70

    const fare = Math.max(
      minimumFare,
      Math.round(baseFare + distance * perKmRate)
    )

    const result = await pool.query(
      `UPDATE rides
       SET fare = $1,
           updated_at = NOW()
       WHERE id = $2
         AND rider_id = $3
         AND status = 'accepted'
       RETURNING id, pickup_address, dropoff_address,
                 status, fare, updated_at`,
      [fare, id, req.user.userId]
    )

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Accepted ride not found for this rider',
      })
    }

    return res.status(200).json({
      success: true,
      message: 'Fare calculated successfully',
      distance_km: distance,
      fare_breakdown: {
        base_fare: baseFare,
        per_km_rate: perKmRate,
        distance_km: distance,
        minimum_fare: minimumFare,
        total_fare: fare,
      },
      ride: result.rows[0],
    })
  } catch (error) {
    console.error('Calculate fare error:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Failed to calculate fare',
    })
  }
}

// Driver: Start an accepted ride
const startRide = async (req, res) => {
  try {
    const { id } = req.params

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ride ID',
      })
    }

    const result = await pool.query(
      `UPDATE rides
       SET status = 'ongoing',
           updated_at = NOW()
       WHERE id = $1
         AND driver_id = $2
         AND status = 'accepted'
       RETURNING id, rider_id, driver_id, pickup_address,
                 dropoff_address, status, fare, updated_at`,
      [id, req.user.userId]
    )

    if (result.rowCount === 0) {
      return res.status(409).json({
        success: false,
        message: 'Ride cannot be started. Check ride status and driver assignment.',
      })
    }

    return res.status(200).json({
      success: true,
      message: 'Ride started successfully',
      ride: result.rows[0],
    })
  } catch (error) {
    console.error('Start ride error:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Failed to start ride',
    })
  }
}

// Driver: Complete an ongoing ride
const completeRide = async (req, res) => {
  try {
    const { id } = req.params

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ride ID',
      })
    }

    const result = await pool.query(
      `UPDATE rides
       SET status = 'completed',
           updated_at = NOW()
       WHERE id = $1
         AND driver_id = $2
         AND status = 'ongoing'
       RETURNING id, rider_id, driver_id, pickup_address,
                 dropoff_address, status, fare, updated_at`,
      [id, req.user.userId]
    )

    if (result.rowCount === 0) {
      return res.status(409).json({
        success: false,
        message: 'Ride cannot be completed. Check ride status and driver assignment.',
      })
    }

    return res.status(200).json({
      success: true,
      message: 'Ride completed successfully',
      ride: result.rows[0],
    })
  } catch (error) {
    console.error('Complete ride error:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Failed to complete ride',
    })
  }
}



// Driver: View assigned rides
const getDriverRides = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         r.id,
         r.rider_id,
         r.driver_id,
         u.full_name AS rider_name,
         r.pickup_address,
         r.dropoff_address,
         r.status,
         r.fare,
         r.created_at,
         r.updated_at
       FROM rides r
       JOIN users u ON u.id = r.rider_id
       WHERE r.driver_id = $1
         AND r.status IN ('accepted', 'ongoing')
       ORDER BY r.created_at DESC`,
      [req.user.userId]
    )

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      rides: result.rows,
    })
  } catch (error) {
    console.error('Get driver rides error:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch driver rides',
    })
  }
}


// Rider: Cancel a requested or accepted ride
const cancelRide = async (req, res) => {
  try {
    const { id } = req.params

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ride ID',
      })
    }

    const result = await pool.query(
      `UPDATE rides
       SET status = 'cancelled',
           updated_at = NOW()
       WHERE id = $1
         AND rider_id = $2
         AND status IN ('requested', 'accepted')
       RETURNING id, rider_id, driver_id, pickup_address,
                 dropoff_address, status, fare, updated_at`,
      [id, req.user.userId]
    )

    if (result.rowCount === 0) {
      return res.status(409).json({
        success: false,
        message:
          'Ride cannot be cancelled. It may not belong to you or has already started.',
      })
    }

    return res.status(200).json({
      success: true,
      message: 'Ride cancelled successfully',
      ride: result.rows[0],
    })
  } catch (error) {
    console.error('Cancel ride error:', error.message)

    return res.status(500).json({
      success: false,
      message: 'Failed to cancel ride',
    })
  }
}


module.exports = {
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
}