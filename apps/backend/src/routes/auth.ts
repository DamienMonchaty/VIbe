import { Elysia, t } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { bearer } from '@elysiajs/bearer'
import { users, userCredentials, findUserByEmail, findUserByUsername, type User } from '../shared/database'

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  username: string
  password: string
  firstName: string
  lastName: string
}

const authRoutes = new Elysia()
  .use(jwt({
    name: 'jwt',
    secret: process.env.JWT_SECRET || 'vibe-secret-key-2024'
  }))
  .use(bearer())
  
  // Inscription
  .post('/register', async ({ body, jwt }) => {
    const { email, username, password, firstName, lastName } = body as RegisterRequest
    
    // Vérifier si l'utilisateur existe déjà
    if (users.find(u => u.email === email || u.username === username)) {
      return {
        error: true,
        message: 'Un utilisateur avec cet email ou ce nom d\'utilisateur existe déjà'
      }
    }
    
    // Créer un nouvel utilisateur
    const newUser: User = {
      id: crypto.randomUUID(),
      email,
      username,
      firstName,
      lastName,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    users.push(newUser)
    userCredentials.set(email, password) // Dans un vrai projet, hasher le mot de passe
    
    // Générer un token JWT
    const token = await jwt.sign({ userId: newUser.id, email: newUser.email })
    
    return {
      success: true,
      user: newUser,
      token
    }
  }, {
    body: t.Object({
      email: t.String({ format: 'email' }),
      username: t.String({ minLength: 3, maxLength: 30 }),
      password: t.String({ minLength: 8 }),
      firstName: t.String({ minLength: 1 }),
      lastName: t.String({ minLength: 1 })
    })
  })
  
  // Connexion
  .post('/login', async ({ body, jwt }) => {
    const { email, password } = body as LoginRequest
    
    // Vérifier les identifiants
    if (!userCredentials.has(email) || userCredentials.get(email) !== password) {
      return {
        error: true,
        message: 'Email ou mot de passe incorrect'
      }
    }
    
    const user = users.find(u => u.email === email)
    if (!user) {
      return {
        error: true,
        message: 'Utilisateur non trouvé'
      }
    }
    
    // Générer un token JWT
    const token = await jwt.sign({ userId: user.id, email: user.email })
    
    return {
      success: true,
      user,
      token
    }
  }, {
    body: t.Object({
      email: t.String({ format: 'email' }),
      password: t.String({ minLength: 1 })
    })
  })
  
  // Vérifier le token
  .get('/verify', async ({ bearer, jwt }) => {
    if (!bearer) {
      return {
        error: true,
        message: 'Token manquant'
      }
    }
    
    try {
      const payload = await jwt.verify(bearer)
      if (!payload || typeof payload !== 'object' || !('userId' in payload)) {
        return {
          error: true,
          message: 'Token invalide'
        }
      }
      const user = users.find(u => u.id === (payload as any).userId)
      
      if (!user) {
        return {
          error: true,
          message: 'Utilisateur non trouvé'
        }
      }
      
      return {
        success: true,
        user
      }
    } catch {
      return {
        error: true,
        message: 'Token invalide'
      }
    }
  })
  
  // Déconnexion (côté client principalement)
  .post('/logout', () => {
    return {
      success: true,
      message: 'Déconnexion réussie'
    }
  })

export default authRoutes
