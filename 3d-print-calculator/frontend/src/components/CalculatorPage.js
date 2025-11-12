import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Container, Grid, Card, CardContent, Typography, Button, Select, MenuItem, Checkbox, FormControlLabel, TextField, Box } from '@mui/material';

ChartJS.register(ArcElement, Tooltip, Legend);

function CalculatorPage() {
    const [file, setFile] = useState(null);
    const [filaments, setFilaments] = useState([]);
    const [selectedFilamentId, setSelectedFilamentId] = useState('');
    const [calculateEnergyCost, setCalculateEnergyCost] = useState(false);
    const [printerWattage, setPrinterWattage] = useState('150');
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        fetchFilaments();
    }, []);

    const fetchFilaments = async () => {
        try {
            const response = await fetch('/api/filaments');
            const data = await response.json();
            setFilaments(data);
            if (data.length > 0) {
                setSelectedFilamentId(data[0].id);
            }
        } catch (err) {
            setError('Could not fetch filaments.');
        }
    };

    const onDrop = useCallback(acceptedFiles => {
        setFile(acceptedFiles[0]);
    }, []);

    const { getRootProps, getInputProps } = useDropzone({ onDrop });

    const handleSubmit = async () => {
        if (!file) {
            setError('Please select a file.');
            return;
        }

        setUploading(true);
        setError('');
        setResult(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const uploadResponse = await fetch('/upload', { method: 'POST', body: formData });
            if (!uploadResponse.ok) throw new Error('File upload failed.');
            const uploadData = await uploadResponse.json();

            const payload = {
                ...uploadData,
                filament_id: selectedFilamentId,
                calculate_energy_cost: calculateEnergyCost,
                printer_wattage: calculateEnergyCost ? parseInt(printerWattage) : null,
            };

            const calcResponse = await fetch('/calculate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!calcResponse.ok) throw new Error('Calculation failed.');
            setResult(await calcResponse.json());
        } catch (err) {
            setError(err.message);
        } finally {
            setUploading(false);
        }
    };

    const pieData = result ? {
        labels: ['Material', 'Energy', 'Labor', 'Maintenance', 'Markup'],
        datasets: [{
            data: [result.material_cost, result.energy_cost, result.labor_cost, result.maintenance_cost, result.markup].filter(v => v > 0),
            backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'],
        }],
    } : {};

    const handleDownloadInvoice = async () => {
        if (!result) return;
        try {
            const response = await fetch('/api/invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(result),
            });
            if (!response.ok) throw new Error('Invoice generation failed.');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'invoice.pdf';
            document.body.appendChild(a);
            a.click();
            a.remove();

        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <Container sx={{ py: 4 }}>
            <Typography variant="h3" component="h1" textAlign="center" gutterBottom>3D Print Cost Calculator</Typography>
            <Grid container spacing={4}>
                <Grid item xs={12} md={6}>
                    <Card><CardContent>
                        <Typography variant="h5" component="h2" gutterBottom>1. Upload File</Typography>
                        <Box {...getRootProps()} sx={{ border: '2px dashed grey', p: 4, textAlign: 'center' }}>
                            <input {...getInputProps()} />
                            <Typography>Drag 'n' drop a file here, or click to select</Typography>
                            {file && <Typography sx={{ mt: 2 }}>Selected: {file.name}</Typography>}
                        </Box>
                    </CardContent></Card>
                    <Card sx={{ mt: 4 }}><CardContent>
                        <Typography variant="h5" component="h2" gutterBottom>2. Configuration</Typography>
                        <Select fullWidth value={selectedFilamentId} onChange={(e) => setSelectedFilamentId(e.target.value)}>
                            {filaments.map(f => <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)}
                        </Select>
                        <FormControlLabel control={<Checkbox checked={calculateEnergyCost} onChange={(e) => setCalculateEnergyCost(e.target.checked)} />} label="Calculate Energy Cost" />
                        {calculateEnergyCost && <TextField label="Printer Wattage (W)" type="number" value={printerWattage} onChange={(e) => setPrinterWattage(e.target.value)} fullWidth />}
                        <Button variant="contained" onClick={handleSubmit} disabled={uploading} sx={{ mt: 2 }}>{uploading ? 'Calculating...' : 'Calculate Cost'}</Button>
                    </CardContent></Card>
                </Grid>
                <Grid item xs={12} md={6}>
                    <Card><CardContent>
                        <Typography variant="h5" component="h2" gutterBottom>3. Results</Typography>
                        {error && <Typography color="error">{error}</Typography>}
                        {result ? (
                            <Box>
                                <Box sx={{ height: 300 }}><Pie data={pieData} options={{ maintainAspectRatio: false }} /></Box>
                                <Typography variant="h6">Total Cost: ${result.total_cost.toFixed(2)}</Typography>
                                {result.mode === 'business' && <Button variant="contained" color="success" onClick={handleDownloadInvoice} sx={{ mt: 2 }}>Download Invoice</Button>}
                            </Box>
                        ) : <Typography>Upload a file and click Calculate to see the results.</Typography>}
                    </CardContent></Card>
                </Grid>
            </Grid>
        </Container>
    );
}

export default CalculatorPage;
