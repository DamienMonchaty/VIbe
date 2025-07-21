import { Elysia, t } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { bearer } from '@elysiajs/bearer'
import { users, type User } from '../shared/database'

// Interface pour les produits de la marketplace
export interface Product {
  id: string
  title: string
  description: string
  price: number
  currency: string
  category: string
  condition: 'new' | 'like-new' | 'good' | 'fair' | 'poor'
  images: string[]
  seller: User
  location?: string
  status: 'available' | 'sold' | 'reserved'
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

export interface CreateProductRequest {
  title: string
  description: string
  price: number
  currency: string
  category: string
  condition: 'new' | 'like-new' | 'good' | 'fair' | 'poor'
  images: string[]
  location?: string
  tags: string[]
}

export interface UpdateProductRequest {
  title?: string
  description?: string
  price?: number
  condition?: 'new' | 'like-new' | 'good' | 'fair' | 'poor'
  images?: string[]
  location?: string
  status?: 'available' | 'sold' | 'reserved'
  tags?: string[]
}

// Base de données temporaire
const products: Product[] = []

const marketplaceRoutes = new Elysia()
  .use(jwt({
    name: 'jwt',
    secret: process.env.JWT_SECRET || 'vibe-secret-key-2024'
  }))
  .use(bearer())
  
  // Middleware d'authentification (optionnel pour certaines routes)
  .derive(async ({ bearer, jwt }) => {
    if (!bearer) {
      return { currentUser: null }
    }
    
    try {
      const payload = await jwt.verify(bearer) as any
      if (!payload) {
        return { currentUser: null }
      }
      
      const user = users.find(u => u.id === payload.userId)
      return { currentUser: user || null }
    } catch {
      return { currentUser: null }
    }
  })
  
  // Obtenir tous les produits (marketplace publique)
  .get('/', ({ query }) => {
    const { 
      page = 1, 
      limit = 20, 
      category, 
      minPrice, 
      maxPrice, 
      condition,
      status = 'available',
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = query
    
    let filteredProducts = products.filter(p => p.status === status)
    
    // Filtres
    if (category) {
      filteredProducts = filteredProducts.filter(p => p.category === category)
    }
    
    if (minPrice !== undefined) {
      filteredProducts = filteredProducts.filter(p => p.price >= Number(minPrice))
    }
    
    if (maxPrice !== undefined) {
      filteredProducts = filteredProducts.filter(p => p.price <= Number(maxPrice))
    }
    
    if (condition) {
      filteredProducts = filteredProducts.filter(p => p.condition === condition)
    }
    
    if (search) {
      const searchTerm = search.toLowerCase()
      filteredProducts = filteredProducts.filter(p => 
        p.title.toLowerCase().includes(searchTerm) ||
        p.description.toLowerCase().includes(searchTerm) ||
        p.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      )
    }
    
    // Tri
    filteredProducts.sort((a, b) => {
      const aValue = a[sortBy as keyof Product]
      const bValue = b[sortBy as keyof Product]
      
      if (aValue === undefined && bValue === undefined) return 0
      if (aValue === undefined) return 1
      if (bValue === undefined) return -1
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })
    
    // Pagination
    const startIndex = (Number(page) - 1) * Number(limit)
    const endIndex = startIndex + Number(limit)
    const paginatedProducts = filteredProducts.slice(startIndex, endIndex)
    
    return {
      success: true,
      products: paginatedProducts,
      pagination: {
        page,
        limit,
        total: filteredProducts.length,
        totalPages: Math.ceil(filteredProducts.length / Number(limit))
      }
    }
  }, {
    query: t.Object({
      page: t.Optional(t.Numeric({ minimum: 1 })),
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
      category: t.Optional(t.String()),
      minPrice: t.Optional(t.Numeric({ minimum: 0 })),
      maxPrice: t.Optional(t.Numeric({ minimum: 0 })),
      condition: t.Optional(t.Union([
        t.Literal('new'),
        t.Literal('like-new'),
        t.Literal('good'),
        t.Literal('fair'),
        t.Literal('poor')
      ])),
      status: t.Optional(t.Union([
        t.Literal('available'),
        t.Literal('sold'),
        t.Literal('reserved')
      ])),
      search: t.Optional(t.String()),
      sortBy: t.Optional(t.String()),
      sortOrder: t.Optional(t.Union([t.Literal('asc'), t.Literal('desc')]))
    })
  })
  
  // Obtenir un produit spécifique
  .get('/:id', ({ params: { id } }) => {
    const product = products.find(p => p.id === id)
    
    if (!product) {
      return {
        error: true,
        message: 'Produit non trouvé'
      }
    }
    
    return {
      success: true,
      product
    }
  }, {
    params: t.Object({
      id: t.String()
    })
  })
  
  // Créer un nouveau produit (authentification requise)
  .post('/', ({ body, currentUser }) => {
    if (!currentUser) {
      return {
        error: true,
        message: 'Authentification requise'
      }
    }
    
    const productData = body as CreateProductRequest
    
    const newProduct: Product = {
      id: crypto.randomUUID(),
      ...productData,
      seller: currentUser,
      status: 'available',
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    products.unshift(newProduct)
    
    return {
      success: true,
      product: newProduct,
      message: 'Produit créé avec succès'
    }
  }, {
    body: t.Object({
      title: t.String({ minLength: 1, maxLength: 200 }),
      description: t.String({ minLength: 1, maxLength: 2000 }),
      price: t.Numeric({ minimum: 0 }),
      currency: t.String({ default: 'EUR' }),
      category: t.String({ minLength: 1 }),
      condition: t.Union([
        t.Literal('new'),
        t.Literal('like-new'),
        t.Literal('good'),
        t.Literal('fair'),
        t.Literal('poor')
      ]),
      images: t.Array(t.String()),
      location: t.Optional(t.String()),
      tags: t.Array(t.String())
    })
  })
  
  // Mettre à jour un produit
  .put('/:id', ({ params: { id }, body, currentUser }) => {
    if (!currentUser) {
      return {
        error: true,
        message: 'Authentification requise'
      }
    }
    
    const product = products.find(p => p.id === id)
    
    if (!product) {
      return {
        error: true,
        message: 'Produit non trouvé'
      }
    }
    
    if (product.seller.id !== currentUser.id) {
      return {
        error: true,
        message: 'Vous ne pouvez modifier que vos propres produits'
      }
    }
    
    const updateData = body as UpdateProductRequest
    
    Object.assign(product, {
      ...updateData,
      updatedAt: new Date()
    })
    
    return {
      success: true,
      product,
      message: 'Produit mis à jour avec succès'
    }
  }, {
    params: t.Object({
      id: t.String()
    }),
    body: t.Object({
      title: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
      description: t.Optional(t.String({ minLength: 1, maxLength: 2000 })),
      price: t.Optional(t.Numeric({ minimum: 0 })),
      condition: t.Optional(t.Union([
        t.Literal('new'),
        t.Literal('like-new'),
        t.Literal('good'),
        t.Literal('fair'),
        t.Literal('poor')
      ])),
      images: t.Optional(t.Array(t.String())),
      location: t.Optional(t.String()),
      status: t.Optional(t.Union([
        t.Literal('available'),
        t.Literal('sold'),
        t.Literal('reserved')
      ])),
      tags: t.Optional(t.Array(t.String()))
    })
  })
  
  // Supprimer un produit
  .delete('/:id', ({ params: { id }, currentUser }) => {
    if (!currentUser) {
      return {
        error: true,
        message: 'Authentification requise'
      }
    }
    
    const productIndex = products.findIndex(p => p.id === id)
    
    if (productIndex === -1) {
      return {
        error: true,
        message: 'Produit non trouvé'
      }
    }
    
    const product = products[productIndex]
    
    if (!product || product.seller.id !== currentUser.id) {
      return {
        error: true,
        message: 'Vous ne pouvez supprimer que vos propres produits'
      }
    }
    
    products.splice(productIndex, 1)
    
    return {
      success: true,
      message: 'Produit supprimé avec succès'
    }
  }, {
    params: t.Object({
      id: t.String()
    })
  })
  
  // Obtenir les produits d'un vendeur
  .get('/seller/:sellerId', ({ params: { sellerId } }) => {
    const sellerProducts = products.filter(p => p.seller.id === sellerId)
    
    return {
      success: true,
      products: sellerProducts,
      count: sellerProducts.length
    }
  }, {
    params: t.Object({
      sellerId: t.String()
    })
  })
  
  // Obtenir les catégories disponibles
  .get('/categories', () => {
    const categories = Array.from(new Set(products.map(p => p.category)))
    
    return {
      success: true,
      categories
    }
  })
  
  // Marquer un produit comme vendu
  .post('/:id/mark-sold', ({ params: { id }, currentUser }) => {
    if (!currentUser) {
      return {
        error: true,
        message: 'Authentification requise'
      }
    }
    
    const product = products.find(p => p.id === id)
    
    if (!product) {
      return {
        error: true,
        message: 'Produit non trouvé'
      }
    }
    
    if (product.seller.id !== currentUser.id) {
      return {
        error: true,
        message: 'Vous ne pouvez modifier que vos propres produits'
      }
    }
    
    product.status = 'sold'
    product.updatedAt = new Date()
    
    return {
      success: true,
      product,
      message: 'Produit marqué comme vendu'
    }
  }, {
    params: t.Object({
      id: t.String()
    })
  })

export default marketplaceRoutes
