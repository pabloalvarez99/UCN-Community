/**
 * Middleware para validar RUT chileno
 * Implementa el algoritmo oficial de validación del dígito verificador
 */

/**
 * Función para calcular el dígito verificador del RUT
 * @param {string} rut - RUT sin el dígito verificador
 * @returns {string} - Dígito verificador calculado
 */
const calculateRutDV = (rut) => {
  let suma = 0;
  let multiplicador = 2;

  // Recorrer el RUT de derecha a izquierda
  for (let i = rut.length - 1; i >= 0; i--) {
    suma += parseInt(rut.charAt(i)) * multiplicador;
    multiplicador = multiplicador < 7 ? multiplicador + 1 : 2;
  }

  const resto = suma % 11;
  const dv = 11 - resto;

  if (dv === 11) return '0';
  if (dv === 10) return 'K';
  return dv.toString();
};

/**
 * Función para validar formato y dígito verificador del RUT
 * @param {string} rutCompleto - RUT completo con formato XX.XXX.XXX-X
 * @returns {object} - { isValid: boolean, cleanRut: string, dv: string }
 */
const validateRutFormat = (rutCompleto) => {
  if (!rutCompleto || typeof rutCompleto !== 'string') {
    return { isValid: false, message: 'RUT es requerido' };
  }

  // Limpiar el RUT (remover puntos, guiones y espacios)
  const cleanRut = rutCompleto.replace(/[.\s-]/g, '').toUpperCase();

  // Validar longitud mínima (7 dígitos + DV) y máxima (8 dígitos + DV)
  if (cleanRut.length < 8 || cleanRut.length > 9) {
    return { isValid: false, message: 'RUT debe tener entre 7 y 8 dígitos más el dígito verificador' };
  }

  // Extraer números y dígito verificador
  const rutNumerico = cleanRut.slice(0, -1);
  const dvIngresado = cleanRut.slice(-1);

  // Validar que la parte numérica solo contenga números
  if (!/^\d+$/.test(rutNumerico)) {
    return { isValid: false, message: 'RUT debe contener solo números' };
  }

  // Validar que el dígito verificador sea válido
  if (!/^[0-9K]$/.test(dvIngresado)) {
    return { isValid: false, message: 'Dígito verificador debe ser un número del 0-9 o K' };
  }

  // Validar rango del RUT (1.000.000 a 99.999.999)
  const rutNumber = parseInt(rutNumerico);
  if (rutNumber < 1000000 || rutNumber > 99999999) {
    return { isValid: false, message: 'RUT fuera del rango válido (1.000.000 - 99.999.999)' };
  }

  // Calcular dígito verificador correcto
  const dvCalculado = calculateRutDV(rutNumerico);

  // Validar dígito verificador
  if (dvIngresado !== dvCalculado) {
    return { 
      isValid: false, 
      message: `Dígito verificador incorrecto. Debería ser ${dvCalculado}` 
    };
  }

  return {
    isValid: true,
    cleanRut: rutNumerico,
    dv: dvCalculado,
    formattedRut: formatRut(rutNumerico, dvCalculado)
  };
};

/**
 * Función para formatear RUT con puntos y guión
 * @param {string} rut - RUT sin formato
 * @param {string} dv - Dígito verificador
 * @returns {string} - RUT formateado XX.XXX.XXX-X
 */
const formatRut = (rut, dv) => {
  const reversed = rut.split('').reverse();
  let formatted = '';
  
  for (let i = 0; i < reversed.length; i++) {
    if (i > 0 && i % 3 === 0) {
      formatted = '.' + formatted;
    }
    formatted = reversed[i] + formatted;
  }
  
  return formatted + '-' + dv;
};

/**
 * Middleware de validación de RUT
 */
const validateRUT = (req, res, next) => {
  const { rut } = req.body;

  if (!rut) {
    return res.status(400).json({
      success: false,
      message: 'El RUT es obligatorio',
      errors: [{ field: 'rut', message: 'RUT requerido' }]
    });
  }

  const validation = validateRutFormat(rut);

  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      message: validation.message,
      errors: [{ field: 'rut', message: validation.message }]
    });
  }

  // Agregar RUT limpio y formateado al request para uso posterior
  req.body.rutLimpio = validation.cleanRut;
  req.body.rutFormateado = validation.formattedRut;
  req.body.digitoVerificador = validation.dv;

  next();
};

module.exports = {
  validateRUT,
  validateRutFormat,
  calculateRutDV,
  formatRut
};