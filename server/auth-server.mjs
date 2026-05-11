import bcrypt from 'bcryptjs'
import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'

dotenv.config()

const AUTH_ENABLED = process.env.AUTH_ENABLED === 'true'
const PORT = Number(process.env.PORT ?? 8787)
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173'
const JWT_SECRET = process.env.JWT_SECRET ?? ''
const DATA_FILE = path.resolve(process.env.AUTH_DATA_FILE ?? '.data/users.json')

if (!AUTH_ENABLED) {
  console.error('Auth server is disabled. Set AUTH_ENABLED=true in your environment to run it.')
  process.exit(1)
}

if (JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be at least 32 characters.')
  process.exit(1)
}

const app = express()

app.use(cors({ origin: CORS_ORIGIN }))
app.use(express.json({ limit: '16kb' }))

const registerSchema = z.object({
  name: z.string().trim().min(2).max(40),
  email: z.string().trim().email().max(160).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
})

const loginSchema = z.object({
  email: z.string().trim().email().max(160).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
})

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, auth: 'enabled' })
})

app.post('/api/auth/register', async (request, response, next) => {
  try {
    const input = registerSchema.parse(request.body)
    const database = await readDatabase()

    if (database.users.some((user) => user.email === input.email)) {
      return response.status(409).json({ error: 'Bu e-posta zaten kayıtlı.' })
    }

    const now = new Date().toISOString()
    const user = {
      id: randomUUID(),
      name: input.name,
      email: input.email,
      passwordHash: await bcrypt.hash(input.password, 12),
      createdAt: now,
      updatedAt: now,
    }

    database.users.push(user)
    await writeDatabase(database)

    response.status(201).json({
      token: signToken(user),
      user: publicUser(user),
    })
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/login', async (request, response, next) => {
  try {
    const input = loginSchema.parse(request.body)
    const database = await readDatabase()
    const user = database.users.find((candidate) => candidate.email === input.email)

    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      return response.status(401).json({ error: 'E-posta veya şifre hatalı.' })
    }

    response.json({
      token: signToken(user),
      user: publicUser(user),
    })
  } catch (error) {
    next(error)
  }
})

app.get('/api/auth/me', async (request, response, next) => {
  try {
    const payload = verifyToken(request.headers.authorization)
    const database = await readDatabase()
    const user = database.users.find((candidate) => candidate.id === payload.sub)

    if (!user) {
      return response.status(401).json({ error: 'Oturum bulunamadı.' })
    }

    response.json({ user: publicUser(user) })
  } catch (error) {
    next(error)
  }
})

app.use((error, _request, response, _next) => {
  if (error instanceof z.ZodError) {
    return response.status(400).json({ error: 'Form alanlarını kontrol et.' })
  }

  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    return response.status(401).json({ error: 'Oturum geçersiz.' })
  }

  console.error(error)
  response.status(500).json({ error: 'Sunucu hatası.' })
})

app.listen(PORT, () => {
  console.log(`Auth API ready on http://localhost:${PORT}`)
})

async function readDatabase() {
  try {
    const raw = await readFile(DATA_FILE, 'utf8')
    const parsed = JSON.parse(raw)

    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    return { users: [] }
  }
}

async function writeDatabase(database) {
  await mkdir(path.dirname(DATA_FILE), { recursive: true })
  await writeFile(DATA_FILE, `${JSON.stringify(database, null, 2)}\n`)
}

function signToken(user) {
  return jwt.sign({ email: user.email, name: user.name }, JWT_SECRET, {
    subject: user.id,
    expiresIn: '7d',
  })
}

function verifyToken(authorization = '') {
  const [scheme, token] = authorization.split(' ')

  if (scheme !== 'Bearer' || !token) {
    const error = new Error('Missing token')
    error.name = 'JsonWebTokenError'
    throw error
  }

  return jwt.verify(token, JWT_SECRET)
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  }
}
