import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed')
    return
  }
  const { username, password } = req.body || {}
  const ADMIN_USERNAME = process.env.ADMIN_USERNAME
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    res.status(200).json({ success: false, error: { message: 'Admin credential not configured' } })
    return
  }
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = Buffer.from(`${username}:${Date.now()}`).toString('base64')
    res.status(200).json({ success: true, token })
  } else {
    res.status(200).json({ success: false, error: { message: 'Invalid credential' } })
  }
}

