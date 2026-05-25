import { HashRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { MainLayout } from './layouts/MainLayout'
import { LoginPage } from './pages/LoginPage'
import { Dashboard } from './pages/Dashboard'
import { CarsList } from './pages/CarsList'
import { CarDetails } from './pages/CarDetails'
import { CarForm } from './pages/CarForm'
import { CustomerForm } from './pages/CustomerForm'
import { EditRequests } from './pages/EditRequests'
import { UsersPage } from './pages/UsersPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { ActivityLogPage } from './pages/ActivityLogPage'
import './i18n'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={
        <ProtectedRoute>
          <MainLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="cars" element={<CarsList />} />
        <Route path="cars/new" element={<CarForm />} />
        <Route path="cars/:id" element={<CarDetails />} />
        <Route path="cars/:id/edit" element={<CarForm />} />
        <Route path="cars/:id/customer" element={<CustomerForm />} />
        <Route path="edit-requests" element={<EditRequests />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="activity-log" element={<ActivityLogPage />} />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </HashRouter>
  )
}

export default App
