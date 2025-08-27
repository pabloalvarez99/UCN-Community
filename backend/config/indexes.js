const User = require('../models/User');
const Post = require('../models/Post');
const Chat = require('../models/Chat');
const Message = require('../models/Message');

const createIndexes = async () => {
  try {
    console.log('🔍 Creando índices de base de datos...');

    // Índices adicionales para User
    await User.collection.createIndex(
      { email: 1 },
      { 
        unique: true,
        background: true,
        name: 'user_email_unique'
      }
    );

    await User.collection.createIndex(
      { carrera: 1, campus: 1, año_ingreso: 1 },
      { 
        background: true,
        name: 'user_academic_info'
      }
    );

    await User.collection.createIndex(
      { verificado: 1, isActive: 1, role: 1 },
      { 
        background: true,
        name: 'user_status'
      }
    );

    await User.collection.createIndex(
      { last_login: -1 },
      { 
        background: true,
        name: 'user_last_login',
        sparse: true
      }
    );

    // Índices adicionales para Post
    await Post.collection.createIndex(
      { autor: 1, fecha_publicacion: -1 },
      { 
        background: true,
        name: 'post_author_date'
      }
    );

    await Post.collection.createIndex(
      { categoria: 1, campus_especifico: 1, activo: 1, fecha_publicacion: -1 },
      { 
        background: true,
        name: 'post_category_campus'
      }
    );

    await Post.collection.createIndex(
      { tags: 1, activo: 1 },
      { 
        background: true,
        name: 'post_tags_active'
      }
    );

    await Post.collection.createIndex(
      { 'likes.usuario': 1 },
      { 
        background: true,
        name: 'post_likes_user'
      }
    );

    await Post.collection.createIndex(
      { destacado: 1, fecha_destacado: -1 },
      { 
        background: true,
        name: 'post_featured',
        sparse: true
      }
    );

    await Post.collection.createIndex(
      { reportado: 1, moderado: 1 },
      { 
        background: true,
        name: 'post_moderation'
      }
    );

    await Post.collection.createIndex(
      { tipo: 1, carrera_especifica: 1, año_especifico: 1 },
      { 
        background: true,
        name: 'post_type_academic',
        sparse: true
      }
    );

    // Índices adicionales para Chat
    await Chat.collection.createIndex(
      { 'participantes.usuario': 1, 'participantes.activo': 1, fecha_actualizacion: -1 },
      { 
        background: true,
        name: 'chat_participants_updated'
      }
    );

    await Chat.collection.createIndex(
      { tipo: 1, activo: 1, archivado: 1 },
      { 
        background: true,
        name: 'chat_type_status'
      }
    );

    await Chat.collection.createIndex(
      { carrera: 1, campus: 1, año_academico: 1, tipo: 1 },
      { 
        background: true,
        name: 'chat_academic_filters',
        sparse: true
      }
    );

    await Chat.collection.createIndex(
      { materia: 1, tipo: 1 },
      { 
        background: true,
        name: 'chat_subject_type',
        sparse: true
      }
    );

    await Chat.collection.createIndex(
      { 'ultimo_mensaje.fecha': -1 },
      { 
        background: true,
        name: 'chat_last_message_date',
        sparse: true
      }
    );

    await Chat.collection.createIndex(
      { 'participantes.ultimo_mensaje_visto': 1 },
      { 
        background: true,
        name: 'chat_read_status',
        sparse: true
      }
    );

    // Índices adicionales para Message
    await Message.collection.createIndex(
      { chat_id: 1, eliminado: 1, fecha_envio: -1 },
      { 
        background: true,
        name: 'message_chat_active_date'
      }
    );

    await Message.collection.createIndex(
      { sender_id: 1, fecha_envio: -1 },
      { 
        background: true,
        name: 'message_sender_date'
      }
    );

    await Message.collection.createIndex(
      { 'leido.usuario': 1, 'leido.fecha_lectura': -1 },
      { 
        background: true,
        name: 'message_read_status'
      }
    );

    await Message.collection.createIndex(
      { tipo_mensaje: 1, fecha_envio: -1 },
      { 
        background: true,
        name: 'message_type_date'
      }
    );

    await Message.collection.createIndex(
      { 'respuesta_a.mensaje_id': 1 },
      { 
        background: true,
        name: 'message_reply_to',
        sparse: true
      }
    );

    await Message.collection.createIndex(
      { 'menciones.usuario': 1, fecha_envio: -1 },
      { 
        background: true,
        name: 'message_mentions',
        sparse: true
      }
    );

    await Message.collection.createIndex(
      { reportado: 1, 'reportes.fecha': -1 },
      { 
        background: true,
        name: 'message_reports'
      }
    );

    await Message.collection.createIndex(
      { programado: 1, fecha_programada: 1 },
      { 
        background: true,
        name: 'message_scheduled',
        sparse: true
      }
    );

    // Índice TTL para mensajes temporales (ya existe en el esquema pero lo reforzamos)
    await Message.collection.createIndex(
      { 'temporal.eliminar_en': 1 },
      { 
        expireAfterSeconds: 0,
        background: true,
        name: 'message_temporal_ttl',
        partialFilterExpression: { 
          'temporal.habilitado': true,
          'temporal.eliminar_en': { $exists: true }
        }
      }
    );

    // Índices de texto para búsqueda
    await User.collection.createIndex(
      { 
        name: 'text', 
        email: 'text', 
        carrera: 'text',
        biografia: 'text'
      },
      {
        background: true,
        name: 'user_search_text',
        weights: {
          name: 10,
          email: 5,
          carrera: 3,
          biografia: 1
        },
        default_language: 'spanish'
      }
    );

    await Post.collection.createIndex(
      { 
        titulo: 'text', 
        contenido: 'text', 
        tags: 'text' 
      },
      {
        background: true,
        name: 'post_search_text',
        weights: {
          titulo: 10,
          contenido: 5,
          tags: 2
        },
        default_language: 'spanish'
      }
    );

    await Chat.collection.createIndex(
      {
        nombre_grupo: 'text',
        descripcion: 'text',
        materia: 'text'
      },
      {
        background: true,
        name: 'chat_search_text',
        weights: {
          nombre_grupo: 10,
          materia: 5,
          descripcion: 1
        },
        default_language: 'spanish'
      }
    );

    await Message.collection.createIndex(
      {
        contenido: 'text'
      },
      {
        background: true,
        name: 'message_search_text',
        default_language: 'spanish'
      }
    );

    console.log('✅ Índices creados exitosamente');
    
    // Mostrar estadísticas de índices
    const userIndexes = await User.collection.listIndexes().toArray();
    const postIndexes = await Post.collection.listIndexes().toArray();
    const chatIndexes = await Chat.collection.listIndexes().toArray();
    const messageIndexes = await Message.collection.listIndexes().toArray();
    
    console.log(`📊 Estadísticas de índices:`);
    console.log(`   - User: ${userIndexes.length} índices`);
    console.log(`   - Post: ${postIndexes.length} índices`);
    console.log(`   - Chat: ${chatIndexes.length} índices`);
    console.log(`   - Message: ${messageIndexes.length} índices`);
    
  } catch (error) {
    console.error('❌ Error creando índices:', error);
    throw error;
  }
};

const dropIndexes = async () => {
  try {
    console.log('🗑️  Eliminando índices existentes...');
    
    await User.collection.dropIndexes();
    await Post.collection.dropIndexes();
    await Chat.collection.dropIndexes();
    await Message.collection.dropIndexes();
    
    console.log('✅ Índices eliminados exitosamente');
  } catch (error) {
    console.error('❌ Error eliminando índices:', error);
    throw error;
  }
};

const getIndexStats = async () => {
  try {
    const stats = {};
    
    const collections = [
      { name: 'User', model: User },
      { name: 'Post', model: Post },
      { name: 'Chat', model: Chat },
      { name: 'Message', model: Message }
    ];
    
    for (const collection of collections) {
      const indexes = await collection.model.collection.listIndexes().toArray();
      const collectionStats = await collection.model.collection.stats();
      
      stats[collection.name] = {
        totalIndexes: indexes.length,
        indexes: indexes.map(idx => ({
          name: idx.name,
          key: idx.key,
          unique: idx.unique || false,
          sparse: idx.sparse || false,
          background: idx.background || false,
          expireAfterSeconds: idx.expireAfterSeconds
        })),
        storageSize: collectionStats.storageSize,
        totalIndexSize: collectionStats.totalIndexSize,
        avgObjSize: collectionStats.avgObjSize
      };
    }
    
    return stats;
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas de índices:', error);
    throw error;
  }
};

module.exports = {
  createIndexes,
  dropIndexes,
  getIndexStats
};