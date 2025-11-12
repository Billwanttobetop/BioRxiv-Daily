import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/pages/LoginPage'
import { FavoritesPage } from '@/pages/FavoritesPage'

import { AdminPage } from '@/pages/AdminPage'
import { PaperDetailPage } from '@/pages/PaperDetailPage'
import { AdminLoginPage } from '@/pages/AdminLoginPage'
import { AdminDashboardPage } from '@/pages/AdminDashboardPage'
import { LogVisit } from '@/components/LogVisit'
import { Insights } from '@/components/Insights'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <LogVisit />
        <div className="min-h-screen bg-neutral-50 flex flex-col">
          <Routes>
            {/* Regular routes with navbar and footer */}
            <Route path="/" element={<><Navbar /><div className="flex-1"><HomePage /></div><Footer /></>} />
            <Route path="/login" element={<><Navbar /><div className="flex-1"><LoginPage /></div><Footer /></>} />
            <Route path="/favorites" element={<><Navbar /><div className="flex-1"><FavoritesPage /></div><Footer /></>} />

            <Route path="/admin" element={<><Navbar /><div className="flex-1"><AdminPage /></div><Footer /></>} />
            <Route path="/paper/:id" element={<><Navbar /><div className="flex-1"><PaperDetailPage /></div><Footer /></>} />
            
            {/* Admin routes without navbar and footer */}
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
          </Routes>
          <Insights />
        </div>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
