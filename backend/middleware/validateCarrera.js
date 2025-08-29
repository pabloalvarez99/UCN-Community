/**
 * Middleware para validar carreras de UCN Campus Coquimbo
 * Solo permite las 17 carreras oficiales del campus
 */

// Lista oficial de carreras UCN Campus Coquimbo (17 carreras)
const CARRERAS_UCN_COQUIMBO = [
  'Biología Marina',
  'Ingeniería en Acuicultura', 
  'Ingeniería en Prevención de Riesgos y Medioambiente',
  'Medicina',
  'Enfermería',
  'Nutrición y Dietética',
  'Kinesiología',
  'Ingeniería Civil Industrial',
  'Ingeniería Civil en Computación e Informática',
  'Tecnologías de Información',
  'Ingeniería Comercial',
  'Contador Auditor Diurno',
  'Contador Auditor Vespertino', 
  'Ingeniería en Información y Control de Gestión',
  'Derecho',
  'Periodismo',
  'Psicología'
];

/**
 * Función para normalizar texto para comparación
 * @param {string} text - Texto a normalizar
 * @returns {string} - Texto normalizado
 */
const normalizeText = (text) => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .trim();
};

/**
 * Función para encontrar carrera similar
 * @param {string} carreraInput - Carrera ingresada por el usuario
 * @returns {string|null} - Carrera válida encontrada o null
 */
const findSimilarCarrera = (carreraInput) => {
  const inputNormalized = normalizeText(carreraInput);
  
  // Buscar coincidencia exacta
  const exactMatch = CARRERAS_UCN_COQUIMBO.find(carrera => 
    normalizeText(carrera) === inputNormalized
  );
  
  if (exactMatch) return exactMatch;
  
  // Buscar coincidencia parcial
  const partialMatch = CARRERAS_UCN_COQUIMBO.find(carrera =>
    normalizeText(carrera).includes(inputNormalized) || 
    inputNormalized.includes(normalizeText(carrera))
  );
  
  return partialMatch || null;
};

/**
 * Función para validar si la carrera es de UCN Coquimbo
 * @param {string} carrera - Nombre de la carrera
 * @returns {object} - { isValid: boolean, carreraValida?: string, suggestions?: string[] }
 */
const validateCarreraUCN = (carrera) => {
  if (!carrera || typeof carrera !== 'string') {
    return { 
      isValid: false, 
      message: 'Carrera es requerida',
      suggestions: CARRERAS_UCN_COQUIMBO.slice(0, 5) // Mostrar las primeras 5 como ejemplo
    };
  }

  const carreraTrimmed = carrera.trim();
  
  if (carreraTrimmed.length < 3) {
    return { 
      isValid: false, 
      message: 'El nombre de la carrera es demasiado corto',
      suggestions: CARRERAS_UCN_COQUIMBO.slice(0, 5)
    };
  }

  // Buscar carrera válida
  const carreraValida = findSimilarCarrera(carreraTrimmed);
  
  if (!carreraValida) {
    // Generar sugerencias basadas en similitud
    const suggestions = CARRERAS_UCN_COQUIMBO.filter(carreraOficial => {
      const input = normalizeText(carreraTrimmed);
      const oficial = normalizeText(carreraOficial);
      
      // Buscar palabras en común
      const inputWords = input.split(/\s+/);
      const oficialWords = oficial.split(/\s+/);
      
      return inputWords.some(word => 
        oficialWords.some(oficialWord => 
          oficialWord.includes(word) || word.includes(oficialWord)
        )
      );
    }).slice(0, 3); // Máximo 3 sugerencias

    return {
      isValid: false,
      message: `"${carreraTrimmed}" no es una carrera válida de UCN Campus Coquimbo`,
      suggestions: suggestions.length > 0 ? suggestions : CARRERAS_UCN_COQUIMBO.slice(0, 5)
    };
  }

  return {
    isValid: true,
    carreraValida: carreraValida
  };
};

/**
 * Función para obtener la facultad de una carrera
 * @param {string} carrera - Nombre de la carrera
 * @returns {string} - Nombre de la facultad
 */
const getFacultad = (carrera) => {
  const facultades = {
    'Biología Marina': 'Facultad de Ciencias del Mar',
    'Ingeniería en Acuicultura': 'Facultad de Ciencias del Mar',
    'Ingeniería en Prevención de Riesgos y Medioambiente': 'Facultad de Ingeniería y Ciencias Geológicas',
    'Medicina': 'Facultad de Medicina',
    'Enfermería': 'Facultad de Medicina',
    'Nutrición y Dietética': 'Facultad de Medicina',
    'Kinesiología': 'Facultad de Medicina',
    'Ingeniería Civil Industrial': 'Facultad de Ingeniería y Ciencias Geológicas',
    'Ingeniería Civil en Computación e Informática': 'Facultad de Ingeniería y Ciencias Geológicas',
    'Tecnologías de Información': 'Facultad de Ingeniería y Ciencias Geológicas',
    'Ingeniería Comercial': 'Facultad de Economía y Administración',
    'Contador Auditor Diurno': 'Facultad de Economía y Administración',
    'Contador Auditor Vespertino': 'Facultad de Economía y Administración',
    'Ingeniería en Información y Control de Gestión': 'Facultad de Economía y Administración',
    'Derecho': 'Facultad de Derecho',
    'Periodismo': 'Facultad de Humanidades',
    'Psicología': 'Facultad de Humanidades'
  };

  return facultades[carrera] || 'Facultad no determinada';
};

/**
 * Middleware de validación de carrera
 */
const validateCarrera = (req, res, next) => {
  const { carrera } = req.body;

  if (!carrera) {
    return res.status(400).json({
      success: false,
      message: 'La carrera es obligatoria',
      errors: [{ field: 'carrera', message: 'Carrera requerida' }],
      data: {
        carrerasDisponibles: CARRERAS_UCN_COQUIMBO
      }
    });
  }

  const validation = validateCarreraUCN(carrera);

  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      message: validation.message,
      errors: [{ field: 'carrera', message: validation.message }],
      data: {
        sugerencias: validation.suggestions,
        carrerasDisponibles: CARRERAS_UCN_COQUIMBO
      }
    });
  }

  // Agregar información de la carrera al request
  req.body.carreraValida = validation.carreraValida;
  req.body.facultad = getFacultad(validation.carreraValida);

  next();
};

/**
 * Función para obtener todas las carreras disponibles
 * @returns {Array} - Array con todas las carreras disponibles
 */
const getCarrerasDisponibles = () => {
  return [...CARRERAS_UCN_COQUIMBO];
};

/**
 * Función para obtener carreras por facultad
 * @returns {Object} - Objeto con carreras agrupadas por facultad
 */
const getCarrerasPorFacultad = () => {
  const carrerasPorFacultad = {};
  
  CARRERAS_UCN_COQUIMBO.forEach(carrera => {
    const facultad = getFacultad(carrera);
    if (!carrerasPorFacultad[facultad]) {
      carrerasPorFacultad[facultad] = [];
    }
    carrerasPorFacultad[facultad].push(carrera);
  });
  
  return carrerasPorFacultad;
};

module.exports = {
  validateCarrera,
  validateCarreraUCN,
  getCarrerasDisponibles,
  getCarrerasPorFacultad,
  getFacultad,
  CARRERAS_UCN_COQUIMBO
};