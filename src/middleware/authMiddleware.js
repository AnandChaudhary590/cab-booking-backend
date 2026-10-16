
const jwt = require('jsonwebtoken')

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication token is required',
    })
  }

  const token = authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Invalid authentication token',
    })
  }

  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is missing from environment')

    return res.status(500).json({
      success: false,
      message: 'Authentication is not configured',
    })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    req.user = {
      userId: decoded.userId,
      role: decoded.role,
    }

    next()
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token',
    })
  }
}

module.exports = authMiddleware
