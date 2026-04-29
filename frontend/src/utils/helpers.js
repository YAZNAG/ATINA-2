export const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Une erreur est survenue';

export const formatDate = (date) =>
  new Date(date).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

export const groupPermissionsByModule = (data) => {
  if (Array.isArray(data)) {
    return data.reduce((acc, p) => {
      if (!acc[p.module]) acc[p.module] = [];
      acc[p.module].push(p);
      return acc;
    }, {});
  }
  return data;
};
