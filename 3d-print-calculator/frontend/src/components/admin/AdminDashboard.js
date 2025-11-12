import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Grid, Card, CardContent, Typography, Button, Select, MenuItem, TextField, Box, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';

function AdminDashboard() {
    const [settings, setSettings] = useState(null);
    const [filaments, setFilaments] = useState([]);
    const [newFilament, setNewFilament] = useState({ name: '', density: '', cost_per_gram: '' });
    const [logoFile, setLogoFile] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        fetchSettings();
        fetchFilaments();
    }, []);

    const fetchSettings = async () => {
        const response = await fetch('/api/admin/settings');
        if (response.ok) setSettings(await response.json());
        else navigate('/admin');
    };

    const fetchFilaments = async () => {
        const response = await fetch('/api/filaments');
        setFilaments(await response.json());
    };

    const handleSettingsChange = (e) => setSettings({ ...settings, [e.target.name]: e.target.value });
    const handleSaveSettings = async () => {
        await fetch('/api/admin/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings),
        });
    };

    const handleNewFilamentChange = (e) => setNewFilament({ ...newFilament, [e.target.name]: e.target.value });
    const handleAddFilament = async (e) => {
        e.preventDefault();
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

    const handleLogoUpload = async () => {
        const formData = new FormData();
        formData.append('file', logoFile);
        await fetch('/api/admin/logo', { method: 'POST', body: formData });
        fetchSettings();
    };

    const handleLogout = async () => {
        await fetch('/api/admin/logout', { method: 'POST' });
        navigate('/admin');
    };

    if (!settings) return <Container sx={{ py: 4 }}><Typography>Loading...</Typography></Container>;

    return (
        <Container sx={{ py: 4 }}>
            <Typography variant="h3" component="h1" textAlign="center" gutterBottom>Admin Dashboard</Typography>
            <Button onClick={handleLogout} variant="contained" color="error" sx={{ mb: 4 }}>Logout</Button>
            <Grid container spacing={4}>
                <Grid item xs={12} lg={6}>
                    <Card>
                        <CardContent>
                            <Typography variant="h5" component="h2" gutterBottom>Settings</Typography>
                            <Select label="Mode" name="mode" value={settings.mode} onChange={handleSettingsChange} fullWidth sx={{ mb: 2 }}>
                                <MenuItem value="consumer">Consumer</MenuItem>
                                <MenuItem value="business">Business</MenuItem>
                            </Select>
                            <TextField label="Energy Cost (kWh)" name="energy_cost_kwh" value={settings.energy_cost_kwh} onChange={handleSettingsChange} fullWidth sx={{ mb: 2 }} />
                            <TextField label="Labor Cost (per hour)" name="labor_cost_per_hour" value={settings.labor_cost_per_hour} onChange={handleSettingsChange} fullWidth sx={{ mb: 2 }} />
                            <TextField label="Maintenance Cost (per hour)" name="maintenance_cost_per_hour" value={settings.maintenance_cost_per_hour} onChange={handleSettingsChange} fullWidth sx={{ mb: 2 }} />
                            <TextField label="Markup (%)" name="markup_percentage" value={settings.markup_percentage} onChange={handleSettingsChange} fullWidth sx={{ mb: 2 }} />
                            <TextField label="Business Name" name="business_name" value={settings.business_name} onChange={handleSettingsChange} fullWidth sx={{ mb: 2 }} />
                            <TextField label="Business Address" name="business_address" value={settings.business_address} onChange={handleSettingsChange} fullWidth sx={{ mb: 2 }} />
                            <Box sx={{ mt: 2 }}>
                                <input type="file" onChange={(e) => setLogoFile(e.target.files[0])} />
                                <Button onClick={handleLogoUpload} variant="contained">Upload Logo</Button>
                                {settings.logo_filename && <Typography>Current: {settings.logo_filename}</Typography>}
                            </Box>
                            <Button variant="contained" sx={{ mt: 2 }} onClick={handleSaveSettings}>Save All Settings</Button>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} lg={6}>
                    <Card>
                        <CardContent>
                            <Typography variant="h5" component="h2" gutterBottom>Filaments</Typography>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Name</TableCell>
                                        <TableCell>Density</TableCell>
                                        <TableCell>Cost/g</TableCell>
                                        <TableCell>Action</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {filaments.map((f) => (
                                        <TableRow key={f.id}>
                                            <TableCell>{f.name}</TableCell>
                                            <TableCell>{f.density}</TableCell>
                                            <TableCell>{f.cost_per_gram}</TableCell>
                                            <TableCell>
                                                <Button size="small" variant="outlined" color="error" onClick={() => handleDeleteFilament(f.id)}>Delete</Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            <form onSubmit={handleAddFilament}>
                                <Typography variant="h6" sx={{ mt: 4 }}>Add New Filament</Typography>
                                <TextField label="Name" name="name" value={newFilament.name} onChange={handleNewFilamentChange} fullWidth sx={{ mt: 2 }} />
                                <TextField label="Density (g/cm³)" name="density" value={newFilament.density} onChange={handleNewFilamentChange} fullWidth sx={{ mt: 1 }} />
                                <TextField label="Cost per Gram ($)" name="cost_per_gram" value={newFilament.cost_per_gram} onChange={handleNewFilamentChange} fullWidth sx={{ mt: 1 }} />
                                <Button type="submit" variant="contained" sx={{ mt: 2 }}>Add Filament</Button>
                            </form>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Container>
    );
}

export default AdminDashboard;
