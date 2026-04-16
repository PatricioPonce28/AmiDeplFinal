import express from 'express'
import dotenv from 'dotenv' 
import cors from 'cors';
import { createServer } from 'http'
import { Server } from 'socket.io' 
import fileUpload from 'express-fileupload'
import { v2 as cloudinary } from 'cloudinary'
import router from './routers/admin_routes.js';
import estudianteRoutes from './routers/estudiante_routes.js'
import path from 'path';

// Inicializaciones 
const app = express()
const httpServer = createServer(app)

app.set('trust proxy', 1);

dotenv.config()
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Middleware 
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Configurar CORS usando variable de entorno
const corsOptions = {
  origin: process.env.URL_FRONTEND, // URL exacta del frontend
  credentials: true,                // Permitir cookies/sesión
}

app.use(cors(corsOptions))

const io = new Server(httpServer, {           
  cors: {
    origin: process.env.URL_FRONTEND,
    methods: ['GET', 'POST'],
    credentials: true
  }
})

app.use(fileUpload({
    useTempFiles : true,
    tempFileDir : '/tmp/'
}));

// Configuraciones 
app.set(`port`, process.env.PORT || 3000)


// Rutas 
app.get('/',(req,res)=>{
    res.send("Server on")
})

// Rutas para admin
app.use('/api', router)

// Rutas específicas para los estudiantes 
app.use('/api/estudiantes', estudianteRoutes)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Rutas que no existen 
app.use((req, res)=>{res.status(404).send("Endpoint no encontrado")})

// Exportar la instancia de express
export default app
