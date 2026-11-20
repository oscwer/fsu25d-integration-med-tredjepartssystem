
const { verifySessionToken } = require('./session')

async function requireAuth(req, res, next) {
  const token = req.cookies?.shop_session

  if (!token) {
    return res.status(401).json({
      error: 'Not authenticated',
    })
  }

  try {
    const customerId = await verifySessionToken(token)

    req.customerId = customerId
    next()
  } catch (error) {
    return res.status(401).json({
      error: 'Invalid or expired session',
    })
  }
}

module.exports = { requireAuth }
