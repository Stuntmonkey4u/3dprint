import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import CalculatorPage from './components/CalculatorPage';
import AdminLayout from './components/admin/AdminLayout';
import LoginPage from './components/admin/LoginPage';
import AdminDashboard from './components/admin/AdminDashboard';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<CalculatorPage />} />
                <Route path="/admin" element={<AdminLayout />}>
                    <Route index element={<LoginPage />} />
                    <Route path="dashboard" element={<AdminDashboard />} />
                </Route>
            </Routes>
        </Router>
    );
}

export default App;