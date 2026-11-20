
const { SignJWT, jwtVerify } = require('jose')

const encoder = new TextEncoder()

function getJwtSecret() {
  const secret = process.env.JWT_SECRET

  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters')
  }

  return encoder.encode(secret)
}

async function createSessionToken(customerId) {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(customerId))
    .setIssuer('oscars-random-shop')
    .setAudience('oscars-random-shop')
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(getJwtSecret())
}

async function verifySessionToken(token) {
  const { payload } = await jwtVerify(
    token,
    getJwtSecret(),
    {
      issuer: 'oscars-random-shop',
      audience: 'oscars-random-shop',
      algorithms: ['HS256'],
    }
  )

  if (!/^[1-9]\d*$/.test(payload.sub ?? '')) {
    throw new Error('Invalid customer ID')
  }

  return Number(payload.sub)
}

module.exports = {
  createSessionToken,
  verifySessionToken,
}
