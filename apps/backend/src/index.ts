import 'dotenv/config'
import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { jwt } from '@elysiajs/jwt'
import { bearer } from '@elysiajs/bearer'
import { staticPlugin } from '@elysiajs/static'

// Import routes
import authRoutes from './routes/auth'
import userRoutes from './routes/users'
import postRoutes from './routes/posts'
import marketplaceRoutes from './routes/marketplace'
import videoRoutes from './routes/video'

const app = new Elysia()
  .use(cors())
  .use(swagger({
    documentation: {
      info: {
        title: 'Vibe Social Network API',
        version: '1.0.0',
        description: 'API pour le réseau social Vibe avec marketplace et visio'
      }
    }
  }))
  .use(jwt({
    name: 'jwt',
    secret: process.env.JWT_SECRET || 'vibe-secret-key-2024'
  }))
  .use(bearer())
  .use(staticPlugin({
    assets: 'public',
    prefix: '/public'
  }))
  
  // Health check
  .get('/', () => ({ 
    message: 'Vibe Social Network API', 
    version: '1.0.0',
    status: 'running' 
  }))
  
  // Routes
  .group('/api/auth', app => app.use(authRoutes))
  .group('/api/users', app => app.use(userRoutes))
  .group('/api/posts', app => app.use(postRoutes))
  .group('/api/marketplace', app => app.use(marketplaceRoutes))
  .group('/api/video', app => app.use(videoRoutes))
  
  .listen(3002)

console.log(`🦊 Vibe API is running at http://localhost:3002`)
console.log(`📚 Swagger documentation at http://localhost:3002/swagger`)

export default app
