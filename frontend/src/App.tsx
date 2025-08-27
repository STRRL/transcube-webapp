import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import TaskPage from './pages/TaskPage'
import NewTranscriptionPage from './pages/NewTranscriptionPage'
import SettingsPage from './pages/SettingsPage'
import './App.css'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="/task/:taskId" element={<TaskPage />} />
          <Route path="/new" element={<NewTranscriptionPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App
