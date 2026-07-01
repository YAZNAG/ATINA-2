const { io } = require('socket.io-client');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTQsImVtYWlsIjoidGVzdEBnbWFpbC5jb20iLCJyb2xlIjoiY3VzdG9tZXIiLCJwaG9uZV9jb3VudHJ5IjoiKzIxMiIsInBob25lX251bWJlciI6IjY1NTU1NTU1NSIsImlhdCI6MTc4MjMxNTgwOSwiZXhwIjoxNzgyOTIwNjA5fQ.XIlIGe7Bv9gT-MYdE2LNuy2UczmmknEK1o1vxun37KA';
const CONV_ID = '9c6a1eaf-e4f4-40c4-8aa2-4fc4da7e6336';

const socket = io('http://localhost:5000', {
  path: '/socket/support',
  auth: { token: TOKEN },
});

socket.on('connect', () => {
  console.log('✓ Connecté, socket id:', socket.id);
  socket.emit('join_conversation', { conversation_id: CONV_ID });
  console.log('✓ join_conversation envoyé');
});

socket.on('connect_error', (err) => {
  console.error('✗ Erreur connexion:', err.message);
});

socket.on('error', (err) => {
  console.error('✗ Erreur socket:', err);
});

socket.on('support:new_message', (data) => {
  console.log('📨 Nouveau message:', data);
});

socket.on('support:status_changed', (data) => {
  console.log('🔄 Statut changé:', data);
});

socket.on('support:agent_assigned', (data) => {
  console.log('👤 Agent assigné:', data);
});
