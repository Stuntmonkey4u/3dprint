import React, { useState, useEffect } from 'react';

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

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
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
            const uploadResponse = await fetch('/upload', {
                method: 'POST',
                body: formData,
            });

            if (!uploadResponse.ok) throw new Error('File upload failed.');
            const uploadData = await uploadResponse.json();

            const calculationPayload = {
                ...uploadData,
                filament_id: selectedFilamentId,
                calculate_energy_cost: calculateEnergyCost,
                printer_wattage: calculateEnergyCost ? parseInt(printerWattage) : null,
            };

            const calculateResponse = await fetch('/calculate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(calculationPayload),
            });

            if (!calculateResponse.ok) throw new Error('Calculation failed.');
            const resultData = await calculateResponse.json();
            setResult(resultData);
        } catch (err) {
            setError(err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleDownloadInvoice = async () => {
        const response = await fetch('/api/invoice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(result),
        });
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'invoice.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
    };

    return (
        <div className="App">
            <header className="App-header">
                <h1>3D Print Cost Calculator</h1>
            </header>
            <main>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Upload .gcode or .stl file</label>
                        <input type="file" onChange={handleFileChange} accept=".gcode,.stl" />
                    </div>
                    <div className="form-group">
                        <label>Filament Type</label>
                        <select value={selectedFilamentId} onChange={(e) => setSelectedFilamentId(e.target.value)}>
                            {filaments.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>
                            <input type="checkbox" checked={calculateEnergyCost} onChange={(e) => setCalculateEnergyCost(e.target.checked)} />
                            Calculate Energy Cost
                        </label>
                    </div>
                    {calculateEnergyCost && (
                        <div className="form-group">
                            <label>Printer Wattage (W)</label>
                            <input type="number" value={printerWattage} onChange={(e) => setPrinterWattage(e.target.value)} required />
                        </div>
                    )}
                    <button type="submit" disabled={uploading}>{uploading ? 'Calculating...' : 'Calculate Cost'}</button>
                </form>
                {error && <div className="error">{error}</div>}
                {result && (
                    <div className="result">
                        <h2>Cost Estimate</h2>
                        <p>Material Cost: ${result.material_cost.toFixed(2)}</p>
                        <p>Energy Cost: ${result.energy_cost.toFixed(2)}</p>
                        {result.mode === 'business' && (
                            <>
                                <p>Labor Cost: ${result.labor_cost.toFixed(2)}</p>
                                <p>Maintenance Cost: ${result.maintenance_cost.toFixed(2)}</p>
                                <p>Markup: ${result.markup.toFixed(2)}</p>
                            </>
                        )}
                        <h3>Total Cost: ${result.total_cost.toFixed(2)}</h3>
                        {result.mode === 'business' && (
                            <button onClick={handleDownloadInvoice}>Download Invoice</button>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

export default CalculatorPage;
