const axios = require('axios');

async function testLogin() {
  const baseURL = 'http://localhost:3000/api';
  
  console.log('🔐 Probando login con diferentes usuarios...');
  
  // Probar con profesor
  try {
    console.log('\n1. Probando login con profesor@example.com...');
    const profesorResponse = await axios.post(`${baseURL}/auth/login`, {
      email: 'profesor@example.com',
      password: 'profesor123'
    });
    console.log('✅ Login exitoso como profesor');
    console.log('   Token:', profesorResponse.data.access_token.substring(0, 50) + '...');
    console.log('   User ID:', profesorResponse.data.user.id);
    console.log('   Role:', profesorResponse.data.user.role?.name);
  } catch (error) {
    console.log('❌ Error login profesor:', error.response?.data?.message || error.message);
  }
  
  // Probar con admin
  try {
    console.log('\n2. Probando login con admin@example.com...');
    const adminResponse = await axios.post(`${baseURL}/auth/login`, {
      email: 'admin@example.com',
      password: 'admin123'
    });
    console.log('✅ Login exitoso como admin');
    console.log('   Token:', adminResponse.data.access_token.substring(0, 50) + '...');
    console.log('   User ID:', adminResponse.data.user.id);
    console.log('   Role:', adminResponse.data.user.role?.name);
  } catch (error) {
    console.log('❌ Error login admin:', error.response?.data?.message || error.message);
  }
  
  // Probar con usuario regular
  try {
    console.log('\n3. Probando login con user@example.com...');
    const userResponse = await axios.post(`${baseURL}/auth/login`, {
      email: 'user@example.com',
      password: 'user123'
    });
    console.log('✅ Login exitoso como usuario regular');
    console.log('   Token:', userResponse.data.access_token.substring(0, 50) + '...');
    console.log('   User ID:', userResponse.data.user.id);
    console.log('   Role:', userResponse.data.user.role?.name);
  } catch (error) {
    console.log('❌ Error login usuario:', error.response?.data?.message || error.message);
  }
}

testLogin();