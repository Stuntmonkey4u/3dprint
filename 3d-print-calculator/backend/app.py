from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
import os
from gcodeparser import GcodeParser
from stl import mesh
import numpy as np
from flask_talisman import Talisman

app = Flask(__name__, static_folder='static', static_url_path='')
Talisman(app, force_https=False)

# Configuration
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100 MB

# Hardcoded filament data (for now)
FILAMENTS = {
    'PLA': {'density': 1.24, 'cost_per_kg': 20.0},
    'PETG': {'density': 1.27, 'cost_per_kg': 25.0},
    'ABS': {'density': 1.04, 'cost_per_kg': 22.0},
    'Nylon': {'density': 1.15, 'cost_per_kg': 50.0},
}

def estimate_print_time_from_volume(volume_cm3):
    # This is a very rough estimation.
    # A better model would take into account layer height, print speed, etc.
    # For now, we'll use a simple heuristic.
    # Assume an average print speed of 50 mm/s and a 0.4mm nozzle.
    # This is a placeholder and should be improved.
    return volume_cm3 * 5 # minutes

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file:
        filename = secure_filename(file.filename)
        file_extension = os.path.splitext(filename)[1].lower()

        try:
            if file_extension == '.gcode':
                # Process G-code file in memory
                gcode_content = file.read().decode('utf-8')
                parser = GcodeParser(gcode_content)
                print_time_secs = parser.get_print_time()
                filament_used_mm = parser.get_filament_used()

                # Assuming 1.75mm filament diameter
                filament_radius_mm = 1.75 / 2
                filament_cross_section_mm2 = np.pi * (filament_radius_mm ** 2)
                filament_volume_mm3 = filament_used_mm * filament_cross_section_mm2
                filament_volume_cm3 = filament_volume_mm3 / 1000

                return jsonify({
                    'print_time_minutes': print_time_secs / 60,
                    'filament_volume_cm3': filament_volume_cm3,
                    'filename': filename
                })

            elif file_extension == '.stl':
                # Process STL file in memory
                stl_mesh = mesh.Mesh.from_file(None, fh=file)
                volume, cog, inertia = stl_mesh.get_mass_properties()
                volume_cm3 = volume / 1000

                # Estimate print time (this is a placeholder)
                estimated_print_time_minutes = estimate_print_time_from_volume(volume_cm3)

                return jsonify({
                    'print_time_minutes': estimated_print_time_minutes,
                    'filament_volume_cm3': volume_cm3,
                    'filename': filename
                })
            else:
                return jsonify({'error': 'Unsupported file type'}), 400
        except Exception as e:
            return jsonify({'error': str(e)}), 500

@app.route('/calculate', methods=['POST'])
def calculate_cost():
    data = request.get_json()

    # Input validation
    required_fields = ['filament_volume_cm3', 'print_time_minutes', 'filament_type']
    if not all(field in data for field in required_fields):
        return jsonify({'error': 'Missing required fields'}), 400

    filament_volume_cm3 = data['filament_volume_cm3']
    print_time_minutes = data['print_time_minutes']
    filament_type = data['filament_type']

    if filament_type not in FILAMENTS:
        return jsonify({'error': 'Invalid filament type'}), 400

    # Material cost calculation
    density = FILAMENTS[filament_type]['density']
    filament_weight_g = filament_volume_cm3 * density

    cost_per_kg = data.get('custom_filament_cost_per_kg')
    if cost_per_kg is None:
        cost_per_kg = FILAMENTS[filament_type]['cost_per_kg']

    material_cost = (filament_weight_g / 1000) * cost_per_kg

    # Energy cost calculation (optional)
    energy_cost = 0.0
    if data.get('calculate_energy_cost'):
        printer_wattage = data.get('printer_wattage')
        kwh_cost = data.get('kwh_cost')
        if printer_wattage is None or kwh_cost is None:
            return jsonify({'error': 'Missing energy cost parameters'}), 400

        print_time_hours = print_time_minutes / 60
        energy_cost = print_time_hours * (printer_wattage / 1000) * kwh_cost

    total_cost = material_cost + energy_cost

    return jsonify({
        'material_cost': material_cost,
        'energy_cost': energy_cost,
        'total_cost': total_cost
    })

@app.route('/')
def serve():
    return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
