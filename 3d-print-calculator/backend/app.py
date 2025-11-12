from flask import Flask, request, jsonify, send_from_directory, session
from werkzeug.utils import secure_filename
import os
from gcodeparser import GcodeParser
from stl import mesh
import numpy as np
from flask_talisman import Talisman
from flask_sqlalchemy import SQLAlchemy
from functools import wraps
from flask import make_response
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
import io

app = Flask(__name__, static_folder='static', static_url_path='')
Talisman(app, force_https=False)

# Configuration
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100 MB
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:////data/database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET_KEY', 'a-default-secret-key-for-dev')

db = SQLAlchemy(app)

# --- Database Models ---
class Filament(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    density = db.Column(db.Float, nullable=False)
    cost_per_gram = db.Column(db.Float, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'density': self.density,
            'cost_per_gram': self.cost_per_gram
        }

class AppSettings(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    mode = db.Column(db.String(50), default='consumer', nullable=False)
    energy_cost_kwh = db.Column(db.Float, default=0.15)
    labor_cost_per_hour = db.Column(db.Float, default=20.0)
    maintenance_cost_per_hour = db.Column(db.Float, default=1.0)
    markup_percentage = db.Column(db.Float, default=25.0)
    business_name = db.Column(db.String(200), default='My 3D Printing Business')
    business_address = db.Column(db.String(500), default='')
    logo_filename = db.Column(db.String(200), nullable=True)

    def to_dict(self):
        return {
            'logo_filename': self.logo_filename,
            'mode': self.mode,
            'energy_cost_kwh': self.energy_cost_kwh,
            'labor_cost_per_hour': self.labor_cost_per_hour,
            'maintenance_cost_per_hour': self.maintenance_cost_per_hour,
            'markup_percentage': self.markup_percentage,
            'business_name': self.business_name,
            'business_address': self.business_address
        }

# --- Auth Decorator ---
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'admin' not in session:
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated_function

# --- Helper Function ---
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
    settings = AppSettings.query.first()

    # Input validation
    required_fields = ['filament_volume_cm3', 'print_time_minutes', 'filament_id']
    if not all(field in data for field in required_fields):
        return jsonify({'error': 'Missing required fields'}), 400

    filament_volume_cm3 = data['filament_volume_cm3']
    print_time_minutes = data['print_time_minutes']
    filament_id = data['filament_id']

    filament = Filament.query.get(filament_id)
    if not filament:
        return jsonify({'error': 'Invalid filament type'}), 400

    # Material cost calculation
    filament_weight_g = filament_volume_cm3 * filament.density
    material_cost = filament_weight_g * filament.cost_per_gram

    # Energy cost calculation
    print_time_hours = print_time_minutes / 60
    energy_cost = 0
    if data.get('calculate_energy_cost'):
        printer_wattage = data.get('printer_wattage', 150) # Default to 150W
        energy_cost = (printer_wattage / 1000) * print_time_hours * settings.energy_cost_kwh

    # Business mode calculations
    labor_cost = 0
    maintenance_cost = 0
    total_cost_before_markup = material_cost + energy_cost

    if settings.mode == 'business':
        labor_cost = print_time_hours * settings.labor_cost_per_hour
        maintenance_cost = print_time_hours * settings.maintenance_cost_per_hour
        total_cost_before_markup += labor_cost + maintenance_cost

    markup = total_cost_before_markup * (settings.markup_percentage / 100)
    total_cost = total_cost_before_markup + markup

    return jsonify({
        'material_cost': material_cost,
        'energy_cost': energy_cost,
        'labor_cost': labor_cost,
        'maintenance_cost': maintenance_cost,
        'markup': markup,
        'total_cost': total_cost,
        'mode': settings.mode
    })

@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    data = request.get_json()
    admin_user = os.environ.get('ADMIN_USER', 'admin')
    admin_pass = os.environ.get('ADMIN_PASS', 'password')

    if data.get('username') == admin_user and data.get('password') == admin_pass:
        session['admin'] = True
        return jsonify({'message': 'Login successful'})

    return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/api/admin/logout', methods=['POST'])
@login_required
def admin_logout():
    session.pop('admin', None)
    return jsonify({'message': 'Logout successful'})

@app.route('/api/admin/settings', methods=['GET', 'POST'])
@login_required
def manage_settings():
    settings = AppSettings.query.first()
    if request.method == 'GET':
        return jsonify(settings.to_dict())

    data = request.get_json()
    for key, value in data.items():
        if hasattr(settings, key):
            setattr(settings, key, value)
    db.session.commit()
    return jsonify({'message': 'Settings updated successfully'})

@app.route('/api/filaments', methods=['GET'])
def get_filaments():
    filaments = Filament.query.all()
    return jsonify([f.to_dict() for f in filaments])

@app.route('/api/admin/filaments', methods=['POST'])
@login_required
def create_filament():
    data = request.get_json()
    new_filament = Filament(**data)
    db.session.add(new_filament)
    db.session.commit()
    return jsonify(new_filament.to_dict()), 201

@app.route('/api/admin/filaments/<int:filament_id>', methods=['PUT', 'DELETE'])
@login_required
def manage_filament(filament_id):
    filament = Filament.query.get_or_404(filament_id)
    if request.method == 'PUT':
        data = request.get_json()
        for key, value in data.items():
            setattr(filament, key, value)
        db.session.commit()
        return jsonify(filament.to_dict())

    db.session.delete(filament)
    db.session.commit()
    return jsonify({'message': 'Filament deleted successfully'})

@app.route('/api/admin/logo', methods=['POST'])
@login_required
def upload_logo():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file:
        filename = secure_filename(file.filename)
        file.save(os.path.join('/data/logos', filename))

        settings = AppSettings.query.first()
        settings.logo_filename = filename
        db.session.commit()

        return jsonify({'message': 'Logo uploaded successfully'})

@app.route('/api/logo')
def get_logo():
    settings = AppSettings.query.first()
    if settings and settings.logo_filename:
        return send_from_directory('/data/logos', settings.logo_filename)
    return '', 404

from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle

@app.route('/api/invoice', methods=['POST'])
def generate_invoice():
    data = request.get_json()
    settings = AppSettings.query.first()

    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)

    # Draw logo
    if settings.logo_filename:
        logo_path = os.path.join('/data/logos', settings.logo_filename)
        if os.path.exists(logo_path):
            p.drawImage(logo_path, inch, 9.5 * inch, width=1.5*inch, preserveAspectRatio=True)

    # Business Info
    p.setFont("Helvetica-Bold", 16)
    p.drawString(4 * inch, 10 * inch, settings.business_name)
    p.setFont("Helvetica", 12)
    p.drawString(4 * inch, 9.8 * inch, settings.business_address)

    # Cost Breakdown Table
    table_data = [
        ["Item", "Cost"],
        ["Material", f"${data.get('material_cost', 0):.2f}"],
        ["Energy", f"${data.get('energy_cost', 0):.2f}"],
    ]
    if settings.mode == 'business':
        table_data.extend([
            ["Labor", f"${data.get('labor_cost', 0):.2f}"],
            ["Maintenance", f"${data.get('maintenance_cost', 0):.2f}"],
            ["Markup", f"${data.get('markup', 0):.2f}"],
        ])
    table_data.append(["Total", f"${data.get('total_cost', 0):.2f}"])

    table = Table(table_data, colWidths=[4*inch, 1.5*inch])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.grey),
        ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0,0), (-1,0), 12),
        ('BACKGROUND', (0,1), (-1,-1), colors.beige),
        ('GRID', (0,0), (-1,-1), 1, colors.black)
    ]))

    table.wrapOn(p, 6*inch, 4*inch)
    table.drawOn(p, inch, 7*inch)

    p.showPage()
    p.save()

    buffer.seek(0)
    response = make_response(buffer.getvalue())
    response.headers['Content-Type'] = 'application/pdf'
    response.headers['Content-Disposition'] = 'attachment; filename=invoice.pdf'
    return response

@app.route('/')
def serve():
    return send_from_directory(app.static_folder, 'index.html')

@app.errorhandler(404)
def not_found(e):
    return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
