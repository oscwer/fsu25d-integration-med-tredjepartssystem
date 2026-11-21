let googleConfig

async function getGoogleConfig() {
  const oidc = await import('openid-client')
  if (googleConfig) {
    return googleConfig
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Missing Google OAuth configuration')
  }

  googleConfig = await oidc.discovery(
    new URL('https://accounts.google.com'),
    clientId,
    clientSecret
  )

  return googleConfig
}

module.exports = { getGoogleConfig }
