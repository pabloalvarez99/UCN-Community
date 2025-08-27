# UCN Community

Una aplicación MERN completa para la comunidad universitaria de UCN, que incluye autenticación, chat en tiempo real y gestión de usuarios.

## Tecnologías Utilizadas

### Backend
- **Node.js** con **Express.js**
- **MongoDB** con **Mongoose**
- **JWT** para autenticación
- **Socket.io** para chat en tiempo real
- **bcryptjs** para encriptación de contraseñas
- **CORS** para manejo de peticiones cross-origin

### Frontend
- **React 18** con **TypeScript**
- **React Router** para navegación
- **Axios** para peticiones HTTP
- **Socket.io-client** para comunicación en tiempo real
- **Tailwind CSS** para estilos
- **Context API** para manejo de estado global

## Estructura del Proyecto

```
UCN Community/
├── backend/
│   ├── config/
│   │   └── database.js
│   ├── controllers/
│   │   └── authController.js
│   ├── middleware/
│   │   └── auth.js
│   ├── models/
│   │   └── User.js
│   ├── routes/
│   │   └── auth.js
│   ├── server.js
│   ├── .env
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── ProtectedRoute.tsx
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Register.tsx
│   │   │   └── Dashboard.tsx
│   │   ├── services/
│   │   │   └── api.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── socket.ts
│   │   ├── App.tsx
│   │   └── index.tsx
│   └── package.json
└── README.md
```

## Instalación y Configuración

### Prerrequisitos
- Node.js (v18 o superior)
- MongoDB (local o MongoDB Atlas)
- npm o yarn

### 1. Configurar el Backend

1. Navegar a la carpeta del backend:
   ```bash
   cd backend
   ```

2. Instalar dependencias:
   ```bash
   npm install
   ```

3. Configurar variables de entorno (archivo `.env` ya creado):
   ```env
   PORT=5000
   MONGO_URI=mongodb://localhost:27017/ucn-community
   JWT_SECRET=ucn_community_super_secret_key_2024
   JWT_EXPIRE=7d
   ```

4. Iniciar el servidor:
   ```bash
   npm run dev
   ```

### 2. Configurar el Frontend

1. Navegar a la carpeta del frontend:
   ```bash
   cd frontend
   ```

2. Instalar dependencias:
   ```bash
   npm install
   ```

3. Iniciar la aplicación:
   ```bash
   npm start
   ```

## Funcionalidades

### Autenticación
- ✅ Registro de usuarios con validación
- ✅ Inicio de sesión con JWT
- ✅ Protección de rutas
- ✅ Persistencia de sesión
- ✅ Cierre de sesión

### Chat en Tiempo Real
- ✅ Salas de chat temáticas
- ✅ Mensajes instantáneos
- ✅ Identificación de usuarios
- ✅ Timestamps de mensajes

### Interfaz de Usuario
- ✅ Diseño responsivo con Tailwind CSS
- ✅ Navegación intuitiva
- ✅ Formularios validados
- ✅ Estados de carga

## API Endpoints

### Autenticación
- `POST /api/auth/register` - Registrar usuario
- `POST /api/auth/login` - Iniciar sesión
- `GET /api/auth/me` - Obtener perfil (protegido)

### Socket Events
- `connection` - Conexión establecida
- `joinRoom` - Unirse a una sala
- `sendMessage` - Enviar mensaje
- `receiveMessage` - Recibir mensaje
- `disconnect` - Desconexión

## Desarrollo

### Scripts Disponibles

#### Backend
- `npm start` - Iniciar servidor en producción
- `npm run dev` - Iniciar servidor en desarrollo con nodemon

#### Frontend  
- `npm start` - Iniciar aplicación en desarrollo
- `npm run build` - Construir aplicación para producción
- `npm test` - Ejecutar tests

### Configuración de MongoDB

Si usas MongoDB local, asegúrate de que esté ejecutándose:
```bash
mongod
```

Para MongoDB Atlas, actualiza la variable `MONGO_URI` en `.env` con tu string de conexión.

## Próximas Funcionalidades

- [ ] Perfiles de usuario extendidos
- [ ] Subida de archivos e imágenes
- [ ] Notificaciones push
- [ ] Moderación de chat
- [ ] Salas privadas
- [ ] Historial de mensajes persistente
- [ ] Búsqueda de mensajes
- [ ] Emojis y reacciones

## Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.