import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { FeatureFlagsProvider } from './contexts/FeatureFlagsContext'
import './index.css'

document.documentElement.classList.add('dark')
localStorage.setItem('theme', 'dark')

function Main() {
  useEffect(() => {
    const noop = (e: Event) => e.preventDefault()
    window.addEventListener('contextmenu', noop)
    return () => window.removeEventListener('contextmenu', noop)
  }, [])

  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <FeatureFlagsProvider>
            <App />
          </FeatureFlagsProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}

createRoot(document.getElementById('root')!).render(<Main />)