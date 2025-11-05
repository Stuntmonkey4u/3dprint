from app import app, db, Filament, AppSettings

def create_and_seed_database():
    with app.app_context():
        db.create_all()

        # Check if settings already exist
        if AppSettings.query.first() is None:
            default_settings = AppSettings()
            db.session.add(default_settings)
            db.session.commit()

        # Check if filaments already exist
        if Filament.query.first() is None:
            filaments = [
                Filament(name='PLA', density=1.24, cost_per_gram=0.025),
                Filament(name='PLA+ / PLA Pro', density=1.24, cost_per_gram=0.035),
                Filament(name='PETG', density=1.27, cost_per_gram=0.04),
                Filament(name='ABS', density=1.04, cost_per_gram=0.045),
                Filament(name='TPU / TPE', density=1.20, cost_per_gram=0.065),
                Filament(name='Nylon (PA6 / PA12)', density=1.14, cost_per_gram=0.09),
                Filament(name='PLA-CF', density=1.30, cost_per_gram=0.08),
                Filament(name='PETG-CF', density=1.38, cost_per_gram=0.095),
                Filament(name='Nylon-CF', density=1.35, cost_per_gram=0.115),
                Filament(name='Polycarbonate (PC)', density=1.20, cost_per_gram=0.115),
                Filament(name='ASA', density=1.07, cost_per_gram=0.08),
                Filament(name='PVA (Water-soluble)', density=1.19, cost_per_gram=0.125),
                Filament(name='HIPS', density=1.03, cost_per_gram=0.06),
                Filament(name='PP (Polypropylene)', density=0.91, cost_per_gram=0.07),
                Filament(name='Metal-filled PLA', density=3.0, cost_per_gram=0.15),
                Filament(name='Wood-filled PLA', density=1.20, cost_per_gram=0.055),
            ]
            db.session.bulk_save_objects(filaments)
            db.session.commit()
            print("Database seeded!")
        else:
            print("Database already seeded.")

if __name__ == '__main__':
    create_and_seed_database()
