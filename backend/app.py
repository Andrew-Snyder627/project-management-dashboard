# fmt: off
from dotenv import load_dotenv, find_dotenv
DOTENV_PATH = find_dotenv(usecwd=True)  # be explicit about current working dir
print("Loading .env from:", DOTENV_PATH)  # TEMP: visible in server logs
load_dotenv(DOTENV_PATH)

from action_items_routes import bp_items
from meetings_routes import bp_meetings
from auth_routes import bp_auth
from config import Settings
from models import db
import os
from flask import Flask
from flask_cors import CORS
from flask_migrate import Migrate

# fmt: on


def create_app():
    app = Flask(__name__)
    app.config.from_object(Settings)

    # DB + Migrations
    db.init_app(app)
    Migrate(app, db)

    # CORS for your React dev server
    CORS(app,
         resources={r"/*": {"origins": Settings.FRONTEND_ORIGIN}},
         supports_credentials=True)

    # Blueprints
    app.register_blueprint(bp_auth)
    app.register_blueprint(bp_meetings)
    app.register_blueprint(bp_items)

    @app.get("/")
    def health():
        return {"ok": True}

    @app.get("/debug/env")
    def debug_env():
        import os
        return {
            "LLM_PROVIDER": os.getenv("LLM_PROVIDER"),
            "OPENAI_API_KEY_set": bool(os.getenv("OPENAI_API_KEY")),
            "OPENAI_MODEL": os.getenv("OPENAI_MODEL"),
            "PROMPT_VERSION": os.getenv("PROMPT_VERSION"),
        }

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True)
