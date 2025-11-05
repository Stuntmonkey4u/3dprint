import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function AdminDashboard() {
    const [settings, setSettings] = useState(null);
    const [filaments, setFilaments] = useState([]);
    const [newFilament, setNewFilament] = useState({ name: '', density: '', cost_per_gram: '' });
    const navigate = useNavigate();

    useEffect(() => {
        fetchSettings();
        fetchFilaments();
    }, []);

    const fetchSettings = async () => {
        const response = await fetch('/api/admin/settings');
        if (response.ok) {
            setSettings(await response.json());
        } else {
            navigate('/admin'); // Redirect if not authenticated
        }
    };

    const fetchFilaments = async () => {
        const response = await fetch('/api/filaments');
        setFilaments(await response.json());
    };

    const handleSettingsChange = (e) => {
        setSettings({ ...settings, [e.target.name]: e.target.value });
    };

    const handleSaveSettings = async () => {
        await fetch('/api/admin/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings),
        });
    };

    const handleNewFilamentChange = (e) => {
        setNewFilament({ ...newFilament, [e.target.name]: e.target.value });
    };

    const handleAddFilament = async () => {
        await fetch('/api/admin/filaments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newFilament),
        });
        fetchFilaments();
    };

    const handleDeleteFilament = async (id) => {
        await fetch(`/api/admin/filaments/${id}`, { method: 'DELETE' });
        fetchFilaments();
    };

    const handleLogout = async () => {
        await fetch('/api/admin/logout', { method: 'POST' });
        navigate('/admin');
    };

    if (!settings) return <div>Loading...</div>;

    return (
        <div>
            <h2>Admin Dashboard</h2>
            <button onClick={handleLogout}>Logout</button>

            <h3>Settings</h3>
            <div>
                <label>Mode:</label>
                <select name="mode" value={settings.mode} onChange={handleSettingsChange}>
                    <option value="consumer">Consumer</option>
                    <option value="business">Business</option>
                </select>
            </div>
            <div>
                <label>Energy Cost ($/kWh):</label>
                <input type="number" name="energy_cost_kwh" value={settings.energy_cost_kwh} onChange={handleSettingsChange} />
            </div>
            <div>
                <label>Labor Cost ($/hour):</label>
                <input type="number" name="labor_cost_per_hour" value={settings.labor_cost_per_hour} onChange={handleSettingsChange} />
            </div>
            <div>
                <label>Maintenance Cost ($/hour):</label>
                <input type="number" name="maintenance_cost_per_hour" value={settings.maintenance_cost_per_hour} onChange={handleSettingsChange} />
            </div>
            <div>
                <label>Markup (%):</label>
                <input type="number" name="markup_percentage" value={settings.markup_percentage} onChange={handleSettingsChange} />
            </div>
            <div>
                <label>Business Name:</label>
                <input type="text" name="business_name" value={settings.business_name} onChange={handleSettingsChange} />
            </div>
            <div>
                <label>Business Address:</label>
                <textarea name="business_address" value={settings.business_address} onChange={handleSettingsChange}></textarea>
            </div>
            <button onClick={handleSaveSettings}>Save Settings</button>

            <h3>Filaments</h3>
            {/* Filament management table */}
        </div>
    );
}

export default AdminDashboard;
