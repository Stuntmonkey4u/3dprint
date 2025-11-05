import React, { useState } from 'react';
import './App.css';

function App() {
    const [file, setFile] = useState(null);
    const [filamentType, setFilamentType] = useState('PLA');
    const [customFilamentCost, setCustomFilamentCost] = useState('');
    const [calculateEnergyCost, setCalculateEnergyCost] = useState(false);
    const [printerWattage, setPrinterWattage] = useState('');
    const [kwhCost, setKwhCost] = useState('');
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [uploading, setUploading] = useState(false);

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

            if (!uploadResponse.ok) {
                const errorData = await uploadResponse.json();
                throw new Error(errorData.error || 'File upload failed');
            }

            const uploadData = await uploadResponse.json();

            const calculationPayload = {
                print_time_minutes: uploadData.print_time_minutes,
                filament_volume_cm3: uploadData.filament_volume_cm3,
                filament_type: filamentType,
                custom_filament_cost_per_kg: customFilamentCost ? parseFloat(customFilamentCost) : null,
                calculate_energy_cost: calculateEnergyCost,
                printer_wattage: calculateEnergyCost ? parseInt(printerWattage) : null,
                kwh_cost: calculateEnergyCost ? parseFloat(kwhCost) : null,
            };

            const calculateResponse = await fetch('/calculate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(calculationPayload),
            });

            if (!calculateResponse.ok) {
                const errorData = await calculateResponse.json();
                throw new Error(errorData.error || 'Calculation failed');
            }

            const resultData = await calculateResponse.json();
            setResult(resultData);
        } catch (err) {
            setError(err.message);
        } finally {
            setUploading(false);
        }
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
                        <p className="file-notice">Files are processed in memory and not saved on the server.</p>
                    </div>
                    <div className="form-group">
                        <label>Filament Type</label>
                        <select value={filamentType} onChange={(e) => setFilamentType(e.target.value)}>
                            <option value="PLA">PLA</option>
                            <option value="PETG">PETG</option>
                            <option value="ABS">ABS</option>
                            <option value="Nylon">Nylon</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Custom Filament Cost ($/kg)</label>
                        <input
                            type="number"
                            value={customFilamentCost}
                            onChange={(e) => setCustomFilamentCost(e.target.value)}
                            placeholder="Enter custom cost (optional)"
                        />
                    </div>
                    <div className="form-group">
                        <label>
                            <input
                                type="checkbox"
                                checked={calculateEnergyCost}
                                onChange={(e) => setCalculateEnergyCost(e.target.checked)}
                            />
                            Calculate Energy Cost
                        </label>
                    </div>
                    {calculateEnergyCost && (
                        <>
                            <div className="form-group">
                                <label>Printer Wattage (W)</label>
                                <input
                                    type="number"
                                    value={printerWattage}
                                    onChange={(e) => setPrinterWattage(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Cost per kWh ($)</label>
                                <input
                                    type="number"
                                    value={kwhCost}
                                    onChange={(e) => setKwhCost(e.target.value)}
                                    required
                                />
                            </div>
                        </>
                    )}
                    <button type="submit" disabled={uploading}>
                        {uploading ? 'Calculating...' : 'Calculate Cost'}
                    </button>
                </form>
                {error && <div className="error">{error}</div>}
                {result && (
                    <div className="result">
                        <h2>Cost Estimate</h2>
                        <p>Material Cost: ${result.material_cost.toFixed(2)}</p>
                        <p>Energy Cost: ${result.energy_cost.toFixed(2)}</p>
                        <h3>Total Cost: ${result.total_cost.toFixed(2)}</h3>
                    </div>
                )}
            </main>
        </div>
    );
}

export default App;