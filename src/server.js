
require('dotenv').config()

const http = require('http')
const { Server } = require('socket.io')
const app = require('./app')

const PORT = process.env.PORT || 5000

const httpServer = http.createServer(app)

const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PATCH'],
  },
})

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`)

  // Join a ride room for real-time ride updates
  socket.on('join-ride', (rideId) => {
    if (!rideId) return

    socket.join(`ride:${rideId}`)
    console.log(`Socket ${socket.id} joined ride:${rideId}`)
  })

  // Relay driver GPS coordinates to clients in the same ride room
  socket.on('driver-location-update', (data) => {
    const rideId = data?.rideId
    const latitude = Number(data?.latitude)
    const longitude = Number(data?.longitude)

    if (
      !rideId ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      return
    }

console.log('Driver GPS received:', { rideId, latitude, longitude })

const room = `ride:${rideId}`
console.log('GPS broadcast room:', room)
console.log('Room members:', io.sockets.adapter.rooms.get(room)?.size || 0)

   io.to(room).emit('driver-location-update', {
      rideId,
      latitude,
      longitude,
      timestamp: new Date().toISOString(),
    })
  })

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`)
  })
})

app.set('io', io)

httpServer.listen(PORT, () => {
  console.log(`Cab Booking API running on port ${PORT}`)
  console.log('Socket.IO real-time server is ready')
})
