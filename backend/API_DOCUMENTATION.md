# UCN Community API Documentation

## Base URL
```
http://localhost:5000/api
```

## Autenticación
Todas las rutas (excepto auth) requieren autenticación mediante JWT token en el header:
```
Authorization: Bearer <token>
```

---

## 🔐 Authentication Endpoints

### POST /auth/register
Registrar un nuevo usuario.

**Body:**
```json
{
  "name": "Juan Pérez Silva",
  "email": "juan.perez@alumnos.ucn.cl",
  "password": "MiPassword123!",
  "carrera": "Ingeniería en Sistemas",
  "año_ingreso": 2022,
  "campus": "Antofagasta"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "name": "Juan Pérez Silva",
    "email": "juan.perez@alumnos.ucn.cl",
    "carrera": "Ingeniería en Sistemas",
    "campus": "Antofagasta"
  }
}
```

### POST /auth/login
Iniciar sesión.

**Body:**
```json
{
  "email": "juan.perez@alumnos.ucn.cl",
  "password": "MiPassword123!"
}
```

### GET /auth/me
Obtener información del usuario actual (requiere autenticación).

---

## 👤 Users Endpoints

### GET /users
Buscar usuarios con filtros.

**Query Parameters:**
- `search` - Texto de búsqueda
- `carrera` - Filtrar por carrera
- `campus` - Filtrar por campus
- `año_ingreso` - Filtrar por año de ingreso
- `verificado` - Filtrar por usuarios verificados
- `page` - Página (default: 1)
- `limit` - Resultados por página (default: 20, max: 50)
- `sortBy` - Campo para ordenar (default: name)
- `order` - Dirección del orden: asc/desc (default: asc)

**Example:**
```
GET /users?search=juan&carrera=Ingeniería en Sistemas&page=1&limit=10
```

**Response:**
```json
{
  "success": true,
  "message": "Usuarios encontrados",
  "data": {
    "users": [
      {
        "id": "...",
        "name": "Juan Pérez Silva",
        "carrera": "Ingeniería en Sistemas",
        "campus": "Antofagasta",
        "foto_perfil": "...",
        "verificado": true
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalUsers": 50,
      "hasNextPage": true
    }
  }
}
```

### GET /users/profile
Obtener perfil del usuario actual.

### PUT /users/profile
Actualizar perfil del usuario actual.

**Body:**
```json
{
  "name": "Juan Carlos Pérez Silva",
  "biografia": "Estudiante apasionado por la tecnología",
  "foto_perfil": "https://example.com/avatar.jpg",
  "privacy_settings": {
    "show_email": false,
    "show_career": true,
    "allow_messages": true
  }
}
```

### PUT /users/password
Cambiar contraseña.

**Body:**
```json
{
  "currentPassword": "MiPasswordAntiguo123!",
  "newPassword": "MiPasswordNuevo456!",
  "confirmPassword": "MiPasswordNuevo456!"
}
```

### GET /users/suggestions
Obtener usuarios sugeridos para conectar.

### GET /users/:id
Obtener perfil público de un usuario específico.

---

## 📝 Posts Endpoints

### GET /posts
Obtener posts con filtros y paginación.

**Query Parameters:**
- `search` - Búsqueda en título y contenido
- `categoria` - Filtrar por categoría
- `tipo` - Filtrar por tipo de post
- `campus` - Filtrar por campus específico
- `carrera` - Filtrar por carrera específica
- `año` - Filtrar por año académico
- `autor` - Filtrar por autor
- `destacado` - Solo posts destacados (true/false)
- `page` - Página (default: 1)
- `limit` - Posts por página (default: 20, max: 50)
- `sortBy` - Campo para ordenar (default: fecha_publicacion)
- `order` - Dirección: asc/desc (default: desc)

**Response:**
```json
{
  "success": true,
  "message": "Posts obtenidos exitosamente",
  "data": {
    "posts": [
      {
        "id": "...",
        "titulo": "Pregunta sobre Algoritmos",
        "contenido": "¿Alguien puede ayudarme con...",
        "tipo": "pregunta",
        "categoria": "academico",
        "autor": {
          "id": "...",
          "name": "Juan Pérez",
          "foto_perfil": "..."
        },
        "fecha_publicacion": "2024-01-15T10:30:00Z",
        "total_likes": 5,
        "total_comentarios": 3,
        "user_liked": false,
        "can_edit": false,
        "can_delete": false
      }
    ],
    "pagination": { ... }
  }
}
```

### POST /posts
Crear un nuevo post.

**Body:**
```json
{
  "titulo": "Ayuda con Algoritmos",
  "contenido": "Necesito ayuda para entender...",
  "tipo": "pregunta",
  "categoria": "academico",
  "tags": ["algoritmos", "programacion", "ayuda"],
  "campus_especifico": "Antofagasta",
  "carrera_especifica": "Ingeniería en Sistemas"
}
```

### GET /posts/:id
Obtener un post específico con comentarios.

### PUT /posts/:id
Actualizar un post (solo el autor o admin).

### DELETE /posts/:id
Eliminar un post (soft delete - solo el autor o admin).

### POST /posts/:id/like
Dar o quitar like a un post.

**Response:**
```json
{
  "success": true,
  "message": "Like agregado",
  "data": {
    "liked": true,
    "totalLikes": 6
  }
}
```

### POST /posts/:id/comment
Agregar comentario a un post.

**Body:**
```json
{
  "contenido": "Excelente pregunta, yo también tengo la misma duda."
}
```

---

## 💬 Chat Endpoints

### GET /chats
Obtener todos los chats del usuario.

**Query Parameters:**
- `tipo` - Filtrar por tipo: individual/grupal/canal/estudio
- `search` - Buscar en nombre de grupo
- `page` - Página (default: 1)
- `limit` - Chats por página (default: 20, max: 50)
- `sortBy` - Campo para ordenar (default: fecha_actualizacion)
- `order` - Dirección: asc/desc (default: desc)

**Response:**
```json
{
  "success": true,
  "message": "Chats obtenidos exitosamente",
  "data": {
    "chats": [
      {
        "_id": "...",
        "tipo": "grupal",
        "nombre_display": "Grupo de Estudio - Algoritmos",
        "imagen_display": "...",
        "participantes_count": 5,
        "ultimo_mensaje": {
          "contenido_preview": "Hola, ¿alguien tiene las notas de...",
          "emisor": {
            "name": "María González"
          },
          "fecha": "2024-01-15T15:30:00Z"
        },
        "mensajes_no_leidos": 2,
        "user_role": "miembro"
      }
    ],
    "pagination": { ... }
  }
}
```

### POST /chats
Crear un nuevo chat.

**Body para Chat Individual:**
```json
{
  "tipo": "individual",
  "participantes": ["60f7b3b3b3b3b3b3b3b3b3b3"]
}
```

**Body para Chat Grupal:**
```json
{
  "tipo": "grupal",
  "nombre_grupo": "Grupo de Estudio - Algoritmos",
  "descripcion": "Grupo para estudiar algoritmos y estructuras de datos",
  "participantes": [
    "60f7b3b3b3b3b3b3b3b3b3b3",
    "60f7b3b3b3b3b3b3b3b3b3b4",
    "60f7b3b3b3b3b3b3b3b3b3b5"
  ],
  "campus": "Antofagasta"
}
```

**Body para Chat de Estudio:**
```json
{
  "tipo": "estudio",
  "nombre_grupo": "Algoritmos y Estructuras de Datos",
  "materia": "Algoritmos",
  "carrera": "Ingeniería en Sistemas",
  "campus": "Antofagasta",
  "año_academico": 3,
  "participantes": ["60f7b3b3b3b3b3b3b3b3b3b3"]
}
```

### GET /chats/:id/messages
Obtener mensajes de un chat específico.

**Query Parameters:**
- `page` - Página (default: 1)
- `limit` - Mensajes por página (default: 50, max: 100)
- `before` - Cargar mensajes anteriores a esta fecha
- `search` - Buscar en contenido de mensajes

**Response:**
```json
{
  "success": true,
  "message": "Mensajes obtenidos exitosamente",
  "data": {
    "messages": [
      {
        "_id": "...",
        "contenido": "Hola, ¿cómo están todos?",
        "tipo_mensaje": "texto",
        "sender_id": {
          "name": "Juan Pérez",
          "foto_perfil": "..."
        },
        "fecha_envio": "2024-01-15T10:30:00Z",
        "is_own": false,
        "total_reacciones": 2,
        "user_reaction": "👍",
        "can_edit": false,
        "can_delete": false
      }
    ],
    "pagination": { ... }
  }
}
```

### POST /chats/:id/messages
Enviar mensaje a un chat.

**Body para Mensaje de Texto:**
```json
{
  "contenido": "Hola, ¿cómo están todos?",
  "tipo_mensaje": "texto"
}
```

**Body para Responder a un Mensaje:**
```json
{
  "contenido": "Estoy bien, gracias por preguntar",
  "tipo_mensaje": "texto",
  "respuesta_a": "60f7b3b3b3b3b3b3b3b3b3b3"
}
```

**Body para Mensaje con Archivo:**
```json
{
  "tipo_mensaje": "archivo",
  "archivo": {
    "nombre_original": "documento.pdf",
    "url": "https://example.com/files/documento.pdf",
    "tipo_mime": "application/pdf",
    "tamaño": 1024000
  }
}
```

**Body para Mensaje de Ubicación:**
```json
{
  "tipo_mensaje": "ubicacion",
  "ubicacion": {
    "latitud": -23.6509,
    "longitud": -70.3975,
    "direccion": "Universidad Católica del Norte, Antofagasta",
    "nombre_lugar": "UCN Campus Antofagasta"
  }
}
```

---

## 📊 Response Format

Todas las respuestas siguen el formato estándar:

### Éxito:
```json
{
  "success": true,
  "message": "Operación exitosa",
  "data": { ... },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Error:
```json
{
  "success": false,
  "message": "Descripción del error",
  "error": "Detalles técnicos del error",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Error de Validación:
```json
{
  "success": false,
  "message": "Error de validación",
  "errors": [
    {
      "field": "email",
      "message": "Debe usar un email institucional UCN"
    }
  ]
}
```

---

## 🚦 HTTP Status Codes

- `200` - OK (éxito)
- `201` - Created (recurso creado)
- `400` - Bad Request (datos inválidos)
- `401` - Unauthorized (no autenticado)
- `403` - Forbidden (sin permisos)
- `404` - Not Found (recurso no encontrado)
- `429` - Too Many Requests (rate limit excedido)
- `500` - Internal Server Error (error del servidor)

---

## 🔒 Rate Limiting

- **Búsquedas de usuarios**: 50 requests / 15 minutos
- **Actualización de perfil**: 5 requests / minuto
- **Cambio de contraseña**: 3 requests / 15 minutos
- **Crear posts**: 5 requests / minuto
- **Likes**: 30 requests / minuto
- **Comentarios**: 10 requests / minuto
- **Crear chats**: 5 requests / minuto
- **Enviar mensajes**: 60 requests / minuto

---

## 🏷️ Enums y Valores Válidos

### Carreras:
- Ingeniería Civil
- Ingeniería Industrial
- Ingeniería en Sistemas
- Ingeniería Comercial
- Arquitectura
- Medicina
- Enfermería
- Kinesiología
- Fonoaudiología
- Derecho
- Psicología
- Trabajo Social
- Administración Pública
- Contador Público
- Periodismo
- Publicidad
- Diseño Gráfico

### Campus:
- Antofagasta
- Coquimbo
- Santiago

### Tipos de Post:
- texto
- pregunta
- anuncio
- evento
- recurso
- discusion

### Categorías de Post:
- general
- academico
- social
- deportes
- cultura
- trabajo
- vivienda
- transporte
- salud
- tecnologia
- entretenimiento

### Tipos de Chat:
- individual
- grupal
- canal
- estudio

### Tipos de Mensaje:
- texto
- imagen
- archivo
- audio
- video
- ubicacion

---

## 🔍 Ejemplos de Uso

### Flujo completo de autenticación:
1. `POST /auth/register` - Registrar usuario
2. `POST /auth/login` - Iniciar sesión
3. `GET /auth/me` - Verificar sesión

### Crear y gestionar un post:
1. `POST /posts` - Crear post
2. `POST /posts/:id/like` - Dar like
3. `POST /posts/:id/comment` - Comentar
4. `PUT /posts/:id` - Editar post

### Gestionar chats:
1. `POST /chats` - Crear chat
2. `POST /chats/:id/messages` - Enviar mensaje
3. `GET /chats/:id/messages` - Leer mensajes
4. `GET /chats` - Ver lista de chats