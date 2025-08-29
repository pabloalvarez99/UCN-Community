// Test frontend API functionality
const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testFrontendAPI() {
  console.log('🧪 Testing Frontend API Functionality\n');
  
  try {
    // Test 1: Login with test user
    console.log('1. Testing Login...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'juan.perez@alumnos.ucn.cl',
      password: 'test123'
    });
    
    if (loginResponse.data.success) {
      console.log('✅ Login successful');
      const token = loginResponse.data.data.accessToken;
      const user = loginResponse.data.data.user;
      console.log(`   User: ${user.nombre} ${user.apellidos}`);
      console.log(`   Token: ${token.substring(0, 20)}...`);
      
      // Test 2: Get user chats
      console.log('\n2. Testing Chat API...');
      try {
        const chatsResponse = await axios.get(`${BASE_URL}/chat`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        console.log('✅ Chat API accessible');
        console.log(`   Chats found: ${chatsResponse.data.data?.chats?.length || 0}`);
      } catch (chatError) {
        console.log('⚠️  Chat API response:', chatError.response?.data?.message || 'No chats found');
      }
      
      // Test 3: Search for users
      console.log('\n3. Testing User Search...');
      try {
        const searchResponse = await axios.get(`${BASE_URL}/users/search/maria`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        console.log('✅ User search working');
        console.log(`   Users found: ${searchResponse.data.data?.users?.length || 0}`);
        if (searchResponse.data.data?.users?.length > 0) {
          console.log(`   First user: ${searchResponse.data.data.users[0].nombre}`);
        }
      } catch (searchError) {
        console.log('⚠️  Search API response:', searchError.response?.data?.message || searchError.message);
      }
      
      // Test 4: Create a test chat
      console.log('\n4. Testing Chat Creation...');
      try {
        // Login as second user to get their ID
        const loginResponse2 = await axios.post(`${BASE_URL}/auth/login`, {
          email: 'maria.lopez@alumnos.ucn.cl',
          password: 'test123'
        });
        
        if (loginResponse2.data.success) {
          const secondUserId = loginResponse2.data.data.user._id;
          
          const createChatResponse = await axios.post(`${BASE_URL}/chat`, {
            userId: secondUserId
          }, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          console.log('✅ Chat creation working');
          const chat = createChatResponse.data.data.chat;
          console.log(`   Chat ID: ${chat._id}`);
          console.log(`   Chat name: ${chat.nombre}`);
          
          // Test 5: Send a message
          console.log('\n5. Testing Message Sending...');
          const messageResponse = await axios.post(`${BASE_URL}/chat/${chat._id}/messages`, {
            content: 'Hello from API test!',
            messageType: 'text'
          }, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          console.log('✅ Message sending working');
          const message = messageResponse.data.data.message;
          console.log(`   Message ID: ${message._id}`);
          console.log(`   Content: ${message.contenido}`);
          
          // Test 6: Get messages
          console.log('\n6. Testing Message Retrieval...');
          const messagesResponse = await axios.get(`${BASE_URL}/chat/${chat._id}/messages`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          console.log('✅ Message retrieval working');
          console.log(`   Messages found: ${messagesResponse.data.data.messages?.length || 0}`);
          
        }
      } catch (chatCreateError) {
        console.log('⚠️  Chat creation error:', chatCreateError.response?.data?.message || chatCreateError.message);
      }
      
    } else {
      console.log('❌ Login failed:', loginResponse.data.message);
    }
    
  } catch (error) {
    console.error('❌ API test failed:', error.response?.data?.message || error.message);
  }
  
  console.log('\n✅ Frontend API testing completed!');
}

testFrontendAPI();