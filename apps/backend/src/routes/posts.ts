import { Elysia, t } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { bearer } from '@elysiajs/bearer'
import { users, type User } from '../shared/database'

// Interface pour les posts
export interface Post {
  id: string
  content: string
  author: User
  images?: string[]
  likes: string[] // IDs des utilisateurs qui ont liké
  comments: Comment[]
  createdAt: Date
  updatedAt: Date
}

export interface Comment {
  id: string
  content: string
  author: User
  postId: string
  createdAt: Date
  updatedAt: Date
}

export interface CreatePostRequest {
  content: string
  images?: string[]
}

export interface CreateCommentRequest {
  content: string
}

// Base de données temporaire
const posts: Post[] = []

const postRoutes = new Elysia()
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
  
  // Créer un nouveau post
  .post('/', ({ body, currentUser }) => {
    const { content, images } = body as CreatePostRequest
    
    const newPost: Post = {
      id: crypto.randomUUID(),
      content,
      author: currentUser,
      images: images || [],
      likes: [],
      comments: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    posts.unshift(newPost) // Ajouter au début pour avoir les plus récents en premier
    
    return {
      success: true,
      post: newPost,
      message: 'Post créé avec succès'
    }
  }, {
    body: t.Object({
      content: t.String({ minLength: 1, maxLength: 5000 }),
      images: t.Optional(t.Array(t.String()))
    })
  })
  
  // Obtenir tous les posts (fil d'actualité)
  .get('/', ({ query }) => {
    const { page = 1, limit = 20 } = query
    const pageNum = Number(page)
    const limitNum = Number(limit)
    const startIndex = (pageNum - 1) * limitNum
    const endIndex = startIndex + limitNum
    
    const paginatedPosts = posts
      .slice(startIndex, endIndex)
      .map(post => ({
        ...post,
        likesCount: post.likes.length,
        commentsCount: post.comments.length
      }))
    
    return {
      success: true,
      posts: paginatedPosts,
      pagination: {
        page,
        limit,
        total: posts.length,
        totalPages: Math.ceil(posts.length / limitNum)
      }
    }
  }, {
    query: t.Object({
      page: t.Optional(t.Numeric({ minimum: 1 })),
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 }))
    })
  })
  
  // Obtenir un post spécifique
  .get('/:id', ({ params: { id } }) => {
    const post = posts.find(p => p.id === id)
    
    if (!post) {
      return {
        error: true,
        message: 'Post non trouvé'
      }
    }
    
    return {
      success: true,
      post: {
        ...post,
        likesCount: post.likes.length,
        commentsCount: post.comments.length
      }
    }
  }, {
    params: t.Object({
      id: t.String()
    })
  })
  
  // Mettre à jour un post
  .put('/:id', ({ params: { id }, body, currentUser }) => {
    const post = posts.find(p => p.id === id)
    
    if (!post) {
      return {
        error: true,
        message: 'Post non trouvé'
      }
    }
    
    if (post.author.id !== currentUser.id) {
      return {
        error: true,
        message: 'Vous ne pouvez modifier que vos propres posts'
      }
    }
    
    const { content, images } = body as CreatePostRequest
    
    post.content = content
    post.images = images || post.images
    post.updatedAt = new Date()
    
    return {
      success: true,
      post,
      message: 'Post mis à jour avec succès'
    }
  }, {
    params: t.Object({
      id: t.String()
    }),
    body: t.Object({
      content: t.String({ minLength: 1, maxLength: 5000 }),
      images: t.Optional(t.Array(t.String()))
    })
  })
  
  // Supprimer un post
  .delete('/:id', ({ params: { id }, currentUser }) => {
    const postIndex = posts.findIndex(p => p.id === id)
    
    if (postIndex === -1) {
      return {
        error: true,
        message: 'Post non trouvé'
      }
    }
    
    const post = posts[postIndex]
    
    if (!post || post.author.id !== currentUser.id) {
      return {
        error: true,
        message: 'Vous ne pouvez supprimer que vos propres posts'
      }
    }
    
    posts.splice(postIndex, 1)
    
    return {
      success: true,
      message: 'Post supprimé avec succès'
    }
  }, {
    params: t.Object({
      id: t.String()
    })
  })
  
  // Liker/unliker un post
  .post('/:id/like', ({ params: { id }, currentUser }) => {
    const post = posts.find(p => p.id === id)
    
    if (!post) {
      return {
        error: true,
        message: 'Post non trouvé'
      }
    }
    
    const userLikeIndex = post.likes.indexOf(currentUser.id)
    
    if (userLikeIndex === -1) {
      // Ajouter le like
      post.likes.push(currentUser.id)
      return {
        success: true,
        liked: true,
        likesCount: post.likes.length,
        message: 'Post liké'
      }
    } else {
      // Retirer le like
      post.likes.splice(userLikeIndex, 1)
      return {
        success: true,
        liked: false,
        likesCount: post.likes.length,
        message: 'Like retiré'
      }
    }
  }, {
    params: t.Object({
      id: t.String()
    })
  })
  
  // Ajouter un commentaire
  .post('/:id/comments', ({ params: { id }, body, currentUser }) => {
    const post = posts.find(p => p.id === id)
    
    if (!post) {
      return {
        error: true,
        message: 'Post non trouvé'
      }
    }
    
    const { content } = body as CreateCommentRequest
    
    const newComment: Comment = {
      id: crypto.randomUUID(),
      content,
      author: currentUser,
      postId: id,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    post.comments.push(newComment)
    
    return {
      success: true,
      comment: newComment,
      message: 'Commentaire ajouté avec succès'
    }
  }, {
    params: t.Object({
      id: t.String()
    }),
    body: t.Object({
      content: t.String({ minLength: 1, maxLength: 1000 })
    })
  })
  
  // Obtenir les commentaires d'un post
  .get('/:id/comments', ({ params: { id } }) => {
    const post = posts.find(p => p.id === id)
    
    if (!post) {
      return {
        error: true,
        message: 'Post non trouvé'
      }
    }
    
    return {
      success: true,
      comments: post.comments
    }
  }, {
    params: t.Object({
      id: t.String()
    })
  })

export default postRoutes
