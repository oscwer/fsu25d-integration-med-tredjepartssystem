const {
  createSessionToken,
  verifySessionToken,
} = require('./session')

const { z } = require('zod')
const { findOrCreateCustomer } = require('../services/customerService')

const express = require('express')
const { getGoogleConfig } = require('./googleAuth')

const router = express.Router()

const googleUserSchema = z.object({
  sub: z.string().min(1),
  email: z.email(),
  name: z.string().min(1),
})

router.get('/google', async (req, res) => {
  try {
    const oidc = await import('openid-client')
    const config = await getGoogleConfig()

    // Unika värden för varje inloggningsförsök.
    const state = oidc.randomState()
    const codeVerifier = oidc.randomPKCECodeVerifier()

    const codeChallenge =
      await oidc.calculatePKCECodeChallenge(codeVerifier)

    // Spara värdena tillfälligt i signerade cookies.
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      signed: true,
      path: '/api/auth/google',
    }

    res.cookie('oauth_state', state, cookieOptions)
    res.cookie('oauth_verifier', codeVerifier, cookieOptions)

    const authorizationUrl = oidc.buildAuthorizationUrl(
      config,
      {
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        scope: 'openid email profile',
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      }
    )

    return res.redirect(authorizationUrl.href)
  } catch (error) {
    console.error('Google OAuth start failed:', error.message)
    return res.status(500).json({
      error: 'Could not start Google login',
    })
  }
})


router.get('/google/callback', async (req, res) => {
  const oidc = await import('openid-client')
  const cookieOptions = {
    path: '/api/auth/google',
  }

  // Radera tillfälliga cookies så att de inte återanvänds.
  const state = req.signedCookies?.oauth_state
  const codeVerifier = req.signedCookies?.oauth_verifier

  res.clearCookie('oauth_state', cookieOptions)
  res.clearCookie('oauth_verifier', cookieOptions)

  // Hantera avbruten inloggning.
  if (req.query.error) {
    return res.status(400).send(
      'Google-inloggningen avbröts eller nekades.'
    )
  }

  if (
    typeof state !== 'string' ||
    typeof codeVerifier !== 'string'
  ) {
    return res.status(400).send(
      'Inloggningen kunde inte verifieras. Försök igen.'
    )
  }

  try {
    const config = await getGoogleConfig()

    // Bygg callback-URL med Googles query-parametrar.
    const callbackUrl = new URL(
      req.originalUrl,
      process.env.GOOGLE_REDIRECT_URI
    )

    // Kontrollera state, verifiera PKCE och byt koden mot tokens.
    const tokens = await oidc.authorizationCodeGrant(
      config,
      callbackUrl,
      {
        expectedState: state,
        pkceCodeVerifier: codeVerifier,
        idTokenExpected: true,
      }
    )

    // ID-token har verifierats av openid-client.
    const claims = tokens.claims()

    if (!claims) {
      throw new Error('Missing verified ID token claims')
    }

    const googleUser = googleUserSchema.parse({
    sub: claims.sub,
    email: claims.email,
    name: claims.name,
    })

    const customer = await findOrCreateCustomer(googleUser)


    // Skapa shoppens egen session efter verifierad Google-inloggning.
    
    const sessionToken = await createSessionToken(customer.id)

    res.cookie('shop_session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 2 * 60 * 60 * 1000,
    path: '/',
    })

    return res.redirect(process.env.FRONTEND_URL)


  } catch (error) {
    console.error('Google OAuth callback failed:', error.message)

    return res.status(400).send(
      'Google-inloggningen misslyckades. Försök igen.'
    )
  }
})


router.get('/me', async (req, res) => {
  const token = req.cookies?.shop_session

  if (!token) {
    return res.status(401).json({
      error: 'Not authenticated',
    })
  }

  try {
    const customerId = await verifySessionToken(token)

    return res.json({
      authenticated: true,
      customerId,
    })
  } catch (error) {
    return res.status(401).json({
      error: 'Invalid or expired session',
    })
  }
})


router.post('/logout', (req, res) => {
  res.clearCookie('shop_session', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  })

  return res.json({
    message: 'Logged out successfully',
  })
})


module.exports = router
