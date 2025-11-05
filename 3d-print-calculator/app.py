from flask import Flask, render_template, request, redirect, url_for, session, jsonify
import os
import json
from stl import mesh
import numpy
import datetime
import logging

app = Flask(__name__)
# Load secret key from environment variable
app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'a_default_secret_key')

# Setup logging
logging.basicConfig(level=logging.INFO)

CONFIG_FILE = 'config.json'
UPLOAD_FOLDER = 'uploads'

def load_config():
    with open(CONFIG_FILE, 'r') as f:
        return json.load(f)

def save_config(config):
    with open(CONFIG_FILE, 'w') as f:
        json.dump(config, f, indent=4)

def calculate_print_time(volume_cm3):
    # This is a very rough estimate. A real slicer would be more accurate.
    # Assumptions: 0.2mm layer height, 50mm/s print speed
    # Average cross-sectional area (heuristic)
    avg_cross_sectional_area = volume_cm3 ** (2/3)
    # Number of layers (heuristic)
    num_layers = (volume_cm3 / avg_cross_sectional_area) / 0.2
    # Time per layer (heuristic)
    time_per_layer = avg_cross_sectional_area / 50
    return (num_layers * time_per_layer) / 3600 # in hours


@app.route('/')
def index():
    config = load_config()
    if config['website_mode'] == 'consumer':
        return redirect(url_for('consumer'))
    else:
        return redirect(url_for('business'))

@app.route('/consumer')
def consumer():
    config = load_config()
    enabled_filaments = {k: v for k, v in config['filaments'].items() if v['enabled']}
    return render_template('consumer.html', filaments=enabled_filaments)

@app.route('/business')
def business():
    config = load_config()
    enabled_filaments = {k: v for k, v in config['filaments'].items() if v['enabled']}
    return render_template('business.html', filaments=enabled_filaments)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        # Load credentials from environment variables
        admin_user = os.environ.get('ADMIN_USER', 'admin')
        admin_pass = os.environ.get('ADMIN_PASS', 'password')
        if request.form['username'] == admin_user and request.form['password'] == admin_pass:
            session['logged_in'] = True
            return redirect(url_for('admin'))
        else:
            return 'Invalid Credentials. Please try again.'
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.pop('logged_in', None)
    return redirect(url_for('index'))

@app.route('/admin')
def admin():
    if not session.get('logged_in'):
        return redirect(url_for('login'))
    else:
        config = load_config()
        return render_template('admin.html', config=config)

@app.route('/update_config', methods=['POST'])
def update_config():
    if not session.get('logged_in'):
        return redirect(url_for('login'))

    config = load_config()
    try:
        config['website_mode'] = request.form['website_mode']
        for filament, values in config['filaments'].items():
            values['cost_per_kg'] = float(request.form[f'{filament}_cost'])
            values['market_price_per_kg'] = float(request.form[f'{filament}_market_price'])
            values['enabled'] = f'{filament}_enabled' in request.form

        config['business']['labor_cost_per_hour'] = float(request.form['labor_cost'])
        config['business']['maintenance_cost_per_hour'] = float(request.form['maintenance_cost'])
        config['business']['energy_cost_per_kwh'] = float(request.form['energy_cost'])
        config['company']['name'] = request.form['company_name']
        config['company']['address'] = request.form['company_address']
        config['company']['city_state_zip'] = request.form['company_city_state_zip']
        save_config(config)
    except (ValueError, KeyError) as e:
        app.logger.error(f"Error updating config: {e}")
        return f"Invalid input: {e}. Please ensure all values are numbers and all fields are filled."

    return redirect(url_for('admin'))

@app.route('/lookup_price')
def lookup_price():
    filament_type = request.args.get('filament')
    if not filament_type:
        return jsonify({'error': 'Filament type is required'}), 400

    # This is a placeholder for a more sophisticated price lookup.
    # For now, we'll just return the market price from the config.
    config = load_config()
    price = config['filaments'].get(filament_type, {}).get('market_price_per_kg')

    if price is None:
        return jsonify({'error': 'Filament not found'}), 404

    return jsonify({'price': price})


@app.route('/upload', methods=['POST'])
def upload_file():
    config = load_config()
    if 'file' not in request.files:
        return redirect(request.url)
    file = request.files['file']
    if file.filename == '':
        return redirect(request.url)
    if file:
        filename = file.filename
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)

        try:
            your_mesh = mesh.Mesh.from_file(filepath)
            volume_mm3, cog, inertia = your_mesh.get_mass_properties()
            volume_cm3 = volume_mm3 / 1000.0

            filament_type = request.form.get('filament')
            filament_data = config['filaments'][filament_type]

            weight = volume_cm3 * filament_data['density']

            if config['website_mode'] == 'business':
                material_cost = weight * (filament_data['cost_per_kg'] / 1000.0)
                print_time_hours = calculate_print_time(volume_cm3)
                labor_cost = config['business']['labor_cost_per_hour'] * print_time_hours
                maintenance_cost = config['business']['maintenance_cost_per_hour'] * print_time_hours
                energy_cost = (config['business']['printer_power_watts'] / 1000) * print_time_hours * config['business']['energy_cost_per_kwh']
                total_cost = material_cost + labor_cost + maintenance_cost + energy_cost
                return render_template('invoice.html',
                                       filename=filename,
                                       date=datetime.date.today().strftime("%B %d, %Y"),
                                       material_cost=material_cost,
                                       labor_cost=labor_cost,
                                       maintenance_cost=maintenance_cost,
                                       energy_cost=energy_cost,
                                       total_cost=total_cost,
                                       company=config['company'])
            else: # Consumer mode
                cost_source = request.form.get('cost_source')
                if cost_source == 'custom':
                    custom_cost_per_kg = float(request.form['custom_cost'])
                    material_cost = weight * (custom_cost_per_kg / 1000.0)
                else: # Average cost
                    material_cost = weight * (filament_data['market_price_per_kg'] / 1000.0)

                return render_template('result.html',
                                       filename=filename,
                                       volume=volume_cm3,
                                       weight=weight,
                                       cost=material_cost)
        except (ValueError, KeyError) as e:
            app.logger.error(f"Error processing file: {e}")
            return "There was an error processing your file. Please check the file format and try again."
        finally:
            # Clean up the uploaded file
            if os.path.exists(filepath):
                os.remove(filepath)

if __name__ == '__main__':
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)
    app.run(debug=True, host='0.0.0.0')
