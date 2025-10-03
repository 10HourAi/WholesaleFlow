
export async function logout() {
  try {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      window.location.href = '/auth';
    } else {
      console.error('Logout failed:', result.message);
      // Force redirect anyway to clear local state
      window.location.href = '/auth';
    }
  } catch (error) {
    console.error('Logout failed:', error);
    // Force redirect anyway to clear local state
    window.location.href = '/auth';
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
