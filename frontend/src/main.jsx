import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import SearchApp from './SearchPage'
import { Toaster } from './components/ui/toaster'
import { BrowserRouter } from 'react-router-dom'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Toaster />
    <BrowserRouter>
    <SearchApp />
    </BrowserRouter>
  </StrictMode>,
)
