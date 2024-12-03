import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import SearchApp from './SearchPage'
import { Toaster } from './components/ui/toaster'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Toaster />
    <SearchApp />
  </StrictMode>,
)
