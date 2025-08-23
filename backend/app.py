from action_items_routes import bp_items
from meetings_routes import bp_meetings
from auth_routes import bp_auth
from models import db
from config import Settings
from flask_migrate import Migrate
from flask_cors import CORS
from flask import Flask
from dotenv import load_dotenv, find_dotenv
load_dotenv(find_dotenv(usecwd=True))


def create_app():
    app = Flask(__name__)
    app.config.from_object(Settings)

    # DB + Migrations
    db.init_app(app)
    Migrate(app, db)

    # CORS for React dev server (cookies enabled)
    CORS(
        app,
        resources={r"/*": {"origins": Settings.FRONTEND_ORIGIN}},
        supports_credentials=True,
    )

    # Blueprints
    app.register_blueprint(bp_auth)
    app.register_blueprint(bp_meetings)
    app.register_blueprint(bp_items)

    @app.get("/")
    def health():
        return {"ok": True}

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="localhost", port=5000, debug=True)
