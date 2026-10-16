
const express = require('express')
const {
  createUser,
  loginUser,
  getUsers,
  getMe
} = require('../controllers/userController')

const authMiddleware = require('../middleware/authMiddleware')

const router = express.Router()

router.post('/', createUser)
router.post('/login', loginUser)
router.get('/me', authMiddleware, getMe)

// Temporary public route; protect or remove before deployment.
router.get('/', getUsers)

module.exports = router
