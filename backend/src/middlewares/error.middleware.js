const { Prisma } = require('@prisma/client');

/**
 * Traduit les erreurs Prisma en réponses HTTP propres.
 * Une erreur de base ne doit jamais renvoyer la requête Prisma au client :
 * le message brut contient le nom des modèles, des colonnes et des relations.
 */
function fromPrisma(err) {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2023': // identifiant mal formé (UUID invalide, etc.)
      case 'P2025': // enregistrement introuvable
        return { status: 404, message: 'Ressource introuvable' };
      case 'P2002':
        return { status: 409, message: 'Cette valeur existe déjà' };
      case 'P2003':
        return { status: 409, message: 'Opération impossible : cet élément est lié à d\'autres données' };
      default:
        return { status: 500, message: 'Erreur interne du serveur' };
    }
  }
  if (err instanceof Prisma.PrismaClientValidationError) {
    // Paramètre de mauvais type (identifiant non numérique, champ inconnu…)
    return { status: 400, message: 'Paramètre invalide' };
  }
  if (err instanceof Prisma.PrismaClientUnknownRequestError
    || err instanceof Prisma.PrismaClientRustPanicError
    || err instanceof Prisma.PrismaClientInitializationError) {
    return { status: 500, message: 'Erreur interne du serveur' };
  }
  return null;
}

/** Fichier refusé à l'envoi (taille, format) : erreur de saisie, pas du serveur. */
const isUploadError = (err) => err?.name === 'MulterError' || /^Format non autoris/.test(err?.message || '');

const errorMiddleware = (err, req, res, next) => {
  // body-parser envoie un SyntaxError quand le body JSON est vide ou malformé
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ success: false, message: 'Corps JSON invalide ou vide' });
  }

  console.error(err.stack || err.message);

  const prismaErr = fromPrisma(err);
  const statusCode = prismaErr?.status || err.statusCode || (isUploadError(err) ? 400 : 500);
  // Le détail d'une erreur Prisma reste dans les journaux serveur, pas dans la réponse.
  const message = prismaErr?.message || err.message || 'Erreur interne du serveur';

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorMiddleware;
