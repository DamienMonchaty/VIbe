// Types partagés
export interface User {
  id: string
  email: string
  username: string
  firstName: string
  lastName: string
  avatar?: string
  bio?: string
  location?: string
  website?: string
  createdAt: Date
  updatedAt: Date
}

// Base de données temporaire partagée (à remplacer par une vraie DB)
export const users: User[] = []
export const userCredentials: Map<string, string> = new Map()

// Utilitaires
export const findUserById = (id: string): User | undefined => {
  return users.find(u => u.id === id)
}

export const findUserByEmail = (email: string): User | undefined => {
  return users.find(u => u.email === email)
}

export const findUserByUsername = (username: string): User | undefined => {
  return users.find(u => u.username === username)
}
