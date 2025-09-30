
const BASE_URL = 'http://localhost:5000';

async function testAuthFlow() {
  console.log('🧪 Testing Complete Auth Flow');
  
  const testUser = {
    email: `test-${Date.now()}@example.com`,
    password: 'testpassword123',
    firstName: 'Test',
    lastName: 'User'
  };

  try {
    // Test 1: Signup
    console.log('\n📝 Testing Signup...');
    const signupResponse = await fetch(`${BASE_URL}/api/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser),
    });
    
    const signupResult = await signupResponse.json();
    console.log('Signup Response:', signupResult);
    
    if (!signupResponse.ok) {
      throw new Error(`Signup failed: ${signupResult.message}`);
    }
    
    // Test 2: Login
    console.log('\n🔐 Testing Login...');
    const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password
      }),
    });
    
    const loginResult = await loginResponse.json();
    console.log('Login Response:', loginResult);
    
    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResult.message}`);
    }
    
    // Test 3: Get user info
    console.log('\n👤 Testing Get User Info...');
    const userResponse = await fetch(`${BASE_URL}/api/auth/user`, {
      credentials: 'include',
    });
    
    const userResult = await userResponse.json();
    console.log('User Response:', userResult);
    
    if (!userResponse.ok) {
      throw new Error(`Get user failed: ${userResult.message}`);
    }
    
    // Test 4: Logout
    console.log('\n🚪 Testing Logout...');
    const logoutResponse = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    
    const logoutResult = await logoutResponse.json();
    console.log('Logout Response:', logoutResult);
    
    if (!logoutResponse.ok) {
      throw new Error(`Logout failed: ${logoutResult.message}`);
    }
    
    // Test 5: Verify logout (should be unauthorized)
    console.log('\n🔒 Testing Auth After Logout...');
    const authCheckResponse = await fetch(`${BASE_URL}/api/auth/user`, {
      credentials: 'include',
    });
    
    console.log('Auth Check Status:', authCheckResponse.status);
    
    if (authCheckResponse.ok) {
      console.log('⚠️  Warning: Still authenticated after logout');
    } else {
      console.log('✅ Correctly unauthorized after logout');
    }
    
    console.log('\n✅ All auth tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Auth test failed:', error.message);
  }
}

testAuthFlow();
