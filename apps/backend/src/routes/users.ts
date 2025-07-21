import { Elysia, t } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { bearer } from '@elysiajs/bearer'
import { users, type User } from '../shared/database'

// Interface pour la mise à jour du profil
export interface UpdateProfileRequest {
  firstName?: string
  lastName?: string
  bio?: string
  location?: string
  website?: string
  avatar?: string
}

const userRoutes = new Elysia()
  .use(jwt({
    name: 'jwt',
    secret: process.env.JWT_SECRET || 'vibe-secret-key-2024'
  }))
  .use(bearer())
  
  // Middleware d'authentification
  .derive(async ({ bearer, jwt }) => {
    if (!bearer) {
      throw new Error('Token manquant')
    }
    
    const payload = await jwt.verify(bearer) as any
    if (!payload) {
      throw new Error('Token invalide')
    }
    
    const user = users.find(u => u.id === payload.userId)
    if (!user) {
      throw new Error('Utilisateur non trouvé')
    }
    
    return { currentUser: user }
  })
  
  // Obtenir le profil de l'utilisateur connecté
  .get('/me', ({ currentUser }) => {
    return {
      success: true,
      user: currentUser
    }
  })
  
  // Obtenir le profil d'un utilisateur par ID
  .get('/:id', ({ params: { id } }) => {
    const user = users.find(u => u.id === id)
    
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
  }, {
    params: t.Object({
      id: t.String()
    })
  })
  
  // Mettre à jour le profil
  .put('/me', ({ body, currentUser }) => {
    const updateData = body as UpdateProfileRequest
    
    // Mettre à jour les champs
    Object.assign(currentUser, {
      ...updateData,
      updatedAt: new Date()
    })
    
    return {
      success: true,
      user: currentUser,
      message: 'Profil mis à jour avec succès'
    }
  }, {
    body: t.Object({
      firstName: t.Optional(t.String({ minLength: 1 })),
      lastName: t.Optional(t.String({ minLength: 1 })),
      bio: t.Optional(t.String({ maxLength: 500 })),
      location: t.Optional(t.String({ maxLength: 100 })),
      website: t.Optional(t.String({ maxLength: 200 })),
      avatar: t.Optional(t.String())
    })
  })
  
  // Rechercher des utilisateurs
  .get('/search', ({ query: { q, limit = '10' } }) => {
    if (!q || q.length < 2) {
      return {
        error: true,
        message: 'La recherche doit contenir au moins 2 caractères'
      }
    }
    
    const searchTerm = q.toLowerCase()
    const limitNum = parseInt(limit)
    
    const results = users
      .filter(user => 
        user.firstName.toLowerCase().includes(searchTerm) ||
        user.lastName.toLowerCase().includes(searchTerm) ||
        user.username.toLowerCase().includes(searchTerm)
      )
      .slice(0, limitNum)
    
    return {
      success: true,
      users: results,
      total: results.length
    }
  }, {
    query: t.Object({
      q: t.String({ minLength: 2 }),
      limit: t.Optional(t.String())
    })
  })
  
  // Obtenir les suggestions d'amis (utilisateurs récents)
  .get('/suggestions', ({ currentUser }) => {
    const suggestions = users
      .filter(user => user.id !== currentUser.id)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10)
    
    return {
      success: true,
      suggestions
    }
  })

export default userRoutes
