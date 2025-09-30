
export async function logout() {
  try {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    
    if (response.ok) {
      window.location.href = '/auth';
    }
  } catch (error) {
    console.error('Logout failed:', error);
  }
}

export async function checkAuth() {
  try {
    const response = await fetch('/api/auth/user', {
      credentials: 'include',
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}
