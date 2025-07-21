import { Elysia, t } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { bearer } from '@elysiajs/bearer'
import { users, type User } from '../shared/database'

// Interface pour les salles de visio
export interface VideoRoom {
  id: string
  name: string
  description?: string
  host: User
  participants: User[]
  isPrivate: boolean
  maxParticipants: number
  password?: string
  status: 'waiting' | 'active' | 'ended'
  createdAt: Date
  updatedAt: Date
  endedAt?: Date
}

export interface CreateRoomRequest {
  name: string
  description?: string
  isPrivate: boolean
  maxParticipants: number
  password?: string
}

export interface JoinRoomRequest {
  password?: string
}

// Base de données temporaire
const videoRooms: VideoRoom[] = []

const videoRoutes = new Elysia()
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
  
  // Créer une nouvelle salle de visio
  .post('/rooms', ({ body, currentUser }) => {
    const { name, description, isPrivate, maxParticipants, password } = body as CreateRoomRequest
    
    const newRoom: VideoRoom = {
      id: crypto.randomUUID(),
      name,
      description,
      host: currentUser,
      participants: [currentUser], // L'hôte est automatiquement participant
      isPrivate,
      maxParticipants,
      password,
      status: 'waiting',
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    videoRooms.unshift(newRoom)
    
    return {
      success: true,
      room: newRoom,
      message: 'Salle de visio créée avec succès'
    }
  }, {
    body: t.Object({
      name: t.String({ minLength: 1, maxLength: 100 }),
      description: t.Optional(t.String({ maxLength: 500 })),
      isPrivate: t.Boolean(),
      maxParticipants: t.Numeric({ minimum: 2, maximum: 50 }),
      password: t.Optional(t.String({ minLength: 4 }))
    })
  })
  
  // Obtenir toutes les salles publiques actives
  .get('/rooms', ({ query }) => {
    const { status = 'waiting' } = query
    
    const publicRooms = videoRooms
      .filter(room => !room.isPrivate && room.status === status)
      .map(room => ({
        ...room,
        password: undefined, // Ne pas exposer les mots de passe
        participantCount: room.participants.length
      }))
    
    return {
      success: true,
      rooms: publicRooms,
      count: publicRooms.length
    }
  }, {
    query: t.Object({
      status: t.Optional(t.Union([
        t.Literal('waiting'),
        t.Literal('active'),
        t.Literal('ended')
      ]))
    })
  })
  
  // Obtenir une salle spécifique
  .get('/rooms/:id', ({ params: { id }, currentUser }) => {
    const room = videoRooms.find(r => r.id === id)
    
    if (!room) {
      return {
        error: true,
        message: 'Salle non trouvée'
      }
    }
    
    // Si la salle est privée, vérifier que l'utilisateur y participe ou en est l'hôte
    if (room.isPrivate) {
      const isParticipant = room.participants.some(p => p.id === currentUser.id)
      const isHost = room.host.id === currentUser.id
      
      if (!isParticipant && !isHost) {
        return {
          error: true,
          message: 'Accès non autorisé à cette salle privée'
        }
      }
    }
    
    return {
      success: true,
      room: {
        ...room,
        password: room.host.id === currentUser.id ? room.password : undefined,
        participantCount: room.participants.length
      }
    }
  }, {
    params: t.Object({
      id: t.String()
    })
  })
  
  // Rejoindre une salle
  .post('/rooms/:id/join', ({ params: { id }, body, currentUser }) => {
    const room = videoRooms.find(r => r.id === id)
    
    if (!room) {
      return {
        error: true,
        message: 'Salle non trouvée'
      }
    }
    
    if (room.status === 'ended') {
      return {
        error: true,
        message: 'Cette salle est terminée'
      }
    }
    
    // Vérifier si l'utilisateur est déjà dans la salle
    if (room.participants.some(p => p.id === currentUser.id)) {
      return {
        success: true,
        room,
        message: 'Vous êtes déjà dans cette salle'
      }
    }
    
    // Vérifier la capacité
    if (room.participants.length >= room.maxParticipants) {
      return {
        error: true,
        message: 'La salle est pleine'
      }
    }
    
    // Vérifier le mot de passe si nécessaire
    if (room.password) {
      const { password } = body as JoinRoomRequest
      if (!password || password !== room.password) {
        return {
          error: true,
          message: 'Mot de passe incorrect'
        }
      }
    }
    
    // Ajouter l'utilisateur à la salle
    room.participants.push(currentUser)
    room.updatedAt = new Date()
    
    // Si c'est le premier participant à rejoindre après l'hôte, démarrer la salle
    if (room.participants.length === 2 && room.status === 'waiting') {
      room.status = 'active'
    }
    
    return {
      success: true,
      room: {
        ...room,
        password: undefined,
        participantCount: room.participants.length
      },
      message: 'Vous avez rejoint la salle avec succès'
    }
  }, {
    params: t.Object({
      id: t.String()
    }),
    body: t.Object({
      password: t.Optional(t.String())
    })
  })
  
  // Quitter une salle
  .post('/rooms/:id/leave', ({ params: { id }, currentUser }) => {
    const room = videoRooms.find(r => r.id === id)
    
    if (!room) {
      return {
        error: true,
        message: 'Salle non trouvée'
      }
    }
    
    const participantIndex = room.participants.findIndex(p => p.id === currentUser.id)
    
    if (participantIndex === -1) {
      return {
        error: true,
        message: 'Vous n\'êtes pas dans cette salle'
      }
    }
    
    // Retirer l'utilisateur de la salle
    room.participants.splice(participantIndex, 1)
    room.updatedAt = new Date()
    
    // Si l'hôte quitte, terminer la salle ou transférer l'hébergement
    if (room.host.id === currentUser.id) {
      if (room.participants.length > 0) {
        // Transférer l'hébergement au premier participant
        const newHost = room.participants[0]
        if (newHost) {
          room.host = newHost
        }
      } else {
        // Terminer la salle si plus personne
        room.status = 'ended'
        room.endedAt = new Date()
      }
    }
    
    // Si plus de participants, terminer la salle
    if (room.participants.length === 0) {
      room.status = 'ended'
      room.endedAt = new Date()
    }
    
    return {
      success: true,
      message: 'Vous avez quitté la salle'
    }
  }, {
    params: t.Object({
      id: t.String()
    })
  })
  
  // Terminer une salle (hôte seulement)
  .post('/rooms/:id/end', ({ params: { id }, currentUser }) => {
    const room = videoRooms.find(r => r.id === id)
    
    if (!room) {
      return {
        error: true,
        message: 'Salle non trouvée'
      }
    }
    
    if (room.host.id !== currentUser.id) {
      return {
        error: true,
        message: 'Seul l\'hôte peut terminer la salle'
      }
    }
    
    if (room.status === 'ended') {
      return {
        error: true,
        message: 'La salle est déjà terminée'
      }
    }
    
    room.status = 'ended'
    room.endedAt = new Date()
    room.updatedAt = new Date()
    
    return {
      success: true,
      room,
      message: 'Salle terminée avec succès'
    }
  }, {
    params: t.Object({
      id: t.String()
    })
  })
  
  // Obtenir l'historique des salles de l'utilisateur
  .get('/history', ({ currentUser, query }) => {
    const { page = 1, limit = 20 } = query
    
    const userRooms = videoRooms.filter(room => 
      room.host.id === currentUser.id || 
      room.participants.some(p => p.id === currentUser.id)
    )
    
    const pageNumber = Number(page)
    const limitNumber = Number(limit)
    const startIndex = (pageNumber - 1) * limitNumber
    const endIndex = startIndex + limitNumber
    const paginatedRooms = userRooms.slice(startIndex, endIndex)
    
    return {
      success: true,
      rooms: paginatedRooms.map(room => ({
        ...room,
        password: undefined,
        participantCount: room.participants.length
      })),
      pagination: {
        page,
        limit,
        total: userRooms.length,
        totalPages: Math.ceil(userRooms.length / limitNumber)
      }
    }
  }, {
    query: t.Object({
      page: t.Optional(t.Numeric({ minimum: 1 })),
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 }))
    })
  })
  
  // Mettre à jour les paramètres d'une salle
  .put('/rooms/:id', ({ params: { id }, body, currentUser }) => {
    const room = videoRooms.find(r => r.id === id)
    
    if (!room) {
      return {
        error: true,
        message: 'Salle non trouvée'
      }
    }
    
    if (room.host.id !== currentUser.id) {
      return {
        error: true,
        message: 'Seul l\'hôte peut modifier la salle'
      }
    }
    
    if (room.status === 'ended') {
      return {
        error: true,
        message: 'Impossible de modifier une salle terminée'
      }
    }
    
    const updateData = body as Partial<CreateRoomRequest>
    
    Object.assign(room, {
      ...updateData,
      updatedAt: new Date()
    })
    
    return {
      success: true,
      room: {
        ...room,
        participantCount: room.participants.length
      },
      message: 'Salle mise à jour avec succès'
    }
  }, {
    params: t.Object({
      id: t.String()
    }),
    body: t.Object({
      name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
      description: t.Optional(t.String({ maxLength: 500 })),
      isPrivate: t.Optional(t.Boolean()),
      maxParticipants: t.Optional(t.Numeric({ minimum: 2, maximum: 50 })),
      password: t.Optional(t.String({ minLength: 4 }))
    })
  })

export default videoRoutes
