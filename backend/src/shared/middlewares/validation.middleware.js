const { z, ZodError } = require("zod");

function isZodSchema(obj) {
  return obj instanceof z.ZodType;
}

/**
 * Middleware de validación usando Zod.
 * Soporta tanto un schema único (body) como un objeto { body, params, query }.
 */
const validate = (schemas) => {
  return (req, res, next) => {
    const normalized = isZodSchema(schemas) ? { body: schemas } : schemas;

    const errors = [];

    for (const [part, schema] of Object.entries(normalized || {})) {
      if (!schema) continue;

      let data;
      if (part === "body") data = req.body;
      else if (part === "params") data = req.params;
      else if (part === "query") data = req.query;

      try {
        const parsed = schema.parse(data);
        if (part === "body") req.body = parsed;
        else if (part === "params") req.params = parsed;
        else if (part === "query") req.query = parsed;
      } catch (error) {
        if (error instanceof ZodError) {
          for (const issue of error.issues) {
            errors.push({
              part,
              field: issue.path.join("."),
              message: issue.message,
            });
          }
        } else {
          errors.push({ part, field: "", message: "Error de validación" });
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        message: "Datos de entrada inválidos",
        code: "VALIDATION_ERROR",
        errors,
      });
    }

    next();
  };
};

const validateBody = (schema) => validate({ body: schema });

module.exports = { validate, validateBody };
