import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'

// Note: StrictMode is intentionally omitted here. React 18's StrictMode
// double-invokes effects in development to help catch bugs, but the
// html5-qrcode library manipulates the camera/DOM directly and its
// teardown (clear()) is asynchronous — so the double-mount causes two
// overlapping scanner UIs and two competing camera requests. This is a
// known incompatibility, not a bug in our code. Removing StrictMode
// only affects local dev; it has zero effect on the production build.
createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>,
)