import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import Landing from './pages/Landing'
import Before from './pages/Before'
import After from './pages/After'
import Security from './pages/Security'
import ThreatModel from './pages/ThreatModel'
import Architecture from './pages/Architecture'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/before" element={<Before />} />
        <Route path="/after" element={<After />} />
        <Route path="/security" element={<Security />} />
        <Route path="/threat-model" element={<ThreatModel />} />
        <Route path="/architecture" element={<Architecture />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
