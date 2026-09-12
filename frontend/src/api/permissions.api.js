import api from './axios';

export const getPermissions = () => api.get('/permissions');
// Matrice du classeur : ressource (ligne) × read / write / delete / export (colonne)
export const getPermissionMatrix = () => api.get('/permissions/matrix');
